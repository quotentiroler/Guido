/**
 * Rule-engine guarantee suite.
 *
 * Behavioral guarantees the Guido engine makes ("cannot get config wrong"). Each
 * passing test is a guarantee the engine keeps; the `it.todo` entries are the tracked
 * roadmap of guarantees not yet implemented (Tier 1-3: solver proofs, repair, cross-scope).
 */
import { describe, it, expect } from 'vitest';
import { RuleState, type Field, type Rule } from '@guido/types';
import { applyRules, validateRules, validateRulesAgainstFields, findContradictions, validateValue } from './index.js';

const f = (name: string, value: Field['value'] = '', checked = false, range = ''): Field => ({
  name, value, checked, info: '', example: '', range,
});
const checkedOf = (fields: Field[], name: string) =>
  fields.find((x) => x.name === name)?.checked;

// ============================================================================
// Rule propagation reaches a fixpoint (order-independent chaining)
// ============================================================================
describe('rule propagation converges regardless of rule order', () => {
  it('fires a single rule when its condition holds', () => {
    const fields = [f('A', 'true', true), f('B')];
    const rules: Rule[] = [{ conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.SetToValue, value: 'x' }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'B')).toBe(true);
  });

  it('propagates a 2-hop chain when rules are in dependency order', () => {
    const fields = [f('A', 'true', true), f('B'), f('C')];
    const rules: Rule[] = [
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.SetToValue, value: 'x' }] },
      { conditions: [{ name: 'B', state: RuleState.Set }], targets: [{ name: 'C', state: RuleState.SetToValue, value: 'y' }] },
    ];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'C')).toBe(true);
  });

  it('propagates a 2-hop chain even when rules are in reverse order', () => {
    const fields = [f('A', 'true', true), f('B'), f('C')];
    const rules: Rule[] = [
      // C-rule listed before the B-rule that satisfies its condition
      { conditions: [{ name: 'B', state: RuleState.Set }], targets: [{ name: 'C', state: RuleState.SetToValue, value: 'y' }] },
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.SetToValue, value: 'x' }] },
    ];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'C')).toBe(true);
  });

  it('converges a deep chain (A->B->C->D) irrespective of order', () => {
    const fields = [f('A', 'true', true), f('B'), f('C'), f('D')];
    const rules: Rule[] = [
      { conditions: [{ name: 'C', state: RuleState.Set }], targets: [{ name: 'D', state: RuleState.SetToValue, value: '4' }] },
      { conditions: [{ name: 'B', state: RuleState.Set }], targets: [{ name: 'C', state: RuleState.SetToValue, value: '3' }] },
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.SetToValue, value: '2' }] },
    ];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'D')).toBe(true);
  });
});

// ============================================================================
// Contradiction detection is logical, not just syntactic
// ============================================================================
describe('contradiction detection catches real conflicts', () => {
  it('flags conflicting unconditional targets on the same field', () => {
    const rules: Rule[] = [
      { conditions: [], targets: [{ name: 'X', state: RuleState.Set }] },
      { conditions: [], targets: [{ name: 'X', state: RuleState.Set, not: true }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  it('flags same-condition rules assigning different values', () => {
    const rules: Rule[] = [
      { conditions: [], targets: [{ name: 'X', state: RuleState.SetToValue, value: 'a' }] },
      { conditions: [], targets: [{ name: 'X', state: RuleState.SetToValue, value: 'b' }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  it('flags a conflict under overlapping (superset) conditions', () => {
    // When A=1 AND B=2, rule 1 requires X and rule 2 forbids X -> contradiction.
    const rules: Rule[] = [
      { conditions: [{ name: 'A', state: RuleState.SetToValue, value: '1' }], targets: [{ name: 'X', state: RuleState.Set }] },
      { conditions: [{ name: 'A', state: RuleState.SetToValue, value: '1' }, { name: 'B', state: RuleState.SetToValue, value: '2' }], targets: [{ name: 'X', state: RuleState.Set, not: true }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  it('flags an unconditional requirement vs a conditional prohibition', () => {
    // X is always required, but when A is set X is forbidden -> unsatisfiable when A set.
    const rules: Rule[] = [
      { conditions: [], targets: [{ name: 'X', state: RuleState.Set }] },
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'X', state: RuleState.Set, not: true }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  it('returns a machine-readable counterexample (witnessing config) for a contradiction', () => {
    const rules: Rule[] = [
      { conditions: [{ name: 'A', state: RuleState.SetToValue, value: '1' }], targets: [{ name: 'X', state: RuleState.Set }] },
      { conditions: [{ name: 'A', state: RuleState.SetToValue, value: '1' }, { name: 'B', state: RuleState.SetToValue, value: '2' }], targets: [{ name: 'X', state: RuleState.Set, not: true }] },
    ];
    const found = findContradictions(rules);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].witness).toMatchObject({ A: '1', B: '2' });
  });

  it('flags a non-confluent ruleset (conflicting unconditional assignments)', () => {
    // Two rules that assign X differently make applyRules order-dependent; the engine
    // flags the ruleset as inconsistent rather than silently picking a winner.
    const rules: Rule[] = [
      { conditions: [], targets: [{ name: 'X', state: RuleState.SetToValue, value: 'a' }] },
      { conditions: [], targets: [{ name: 'X', state: RuleState.SetToValue, value: 'b' }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });
});

// ============================================================================
// Cycle detection
// ============================================================================
describe('cycle detection reports circular dependencies', () => {
  it('reports a genuine 3-node cycle', () => {
    const rules: Rule[] = [
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.Set }] },
      { conditions: [{ name: 'B', state: RuleState.Set }], targets: [{ name: 'C', state: RuleState.Set }] },
      { conditions: [{ name: 'C', state: RuleState.Set }], targets: [{ name: 'A', state: RuleState.Set }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });
});

// ============================================================================
// Value validation is sound
// ============================================================================
describe('value validation is sound', () => {
  it('rejects an integer out of range', () => {
    expect(validateValue('999', 'integer(1..100)')).toBe(false);
  });
  it('accepts a valid integer in range', () => {
    expect(validateValue('50', 'integer(1..100)')).toBe(true);
  });
  it('rejects an empty string as an integer', () => {
    expect(validateValue('', 'integer')).toBe(false);
  });
  it('rejects a whitespace-only string as an integer', () => {
    expect(validateValue('   ', 'integer')).toBe(false);
  });
  it('validates enum membership exactly', () => {
    expect(validateValue('prod', 'dev||staging||prod')).toBe(true);
    expect(validateValue('production', 'dev||staging||prod')).toBe(false);
  });
});

// ============================================================================
// Rules must be consistent with the field schema they target
// ============================================================================
describe('rules stay consistent with the field schema', () => {
  it('flags a rule that sets a value violating the target field range', () => {
    // Port must be 1..65535, but a rule forces it to 999999: flagged at validation time
    // rather than silently producing invalid config.
    const fields = [f('Port', '', false, 'integer(1..65535)')];
    const rules: Rule[] = [{ conditions: [], targets: [{ name: 'Port', state: RuleState.SetToValue, value: '999999' }] }];
    expect(validateRulesAgainstFields(rules, fields).isValid).toBe(false);
  });
});

// ============================================================================
// Predicate semantics: Contains is membership, not substring
// ============================================================================
describe('Contains is membership, not substring', () => {
  it('does NOT match an accidental substring ("production" does not contain the item "prod")', () => {
    const fields = [f('Env', 'production', true), f('Flag')];
    const rules: Rule[] = [{ conditions: [{ name: 'Env', state: RuleState.Contains, value: 'prod' }], targets: [{ name: 'Flag', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Flag')).toBe(false);
  });

  it('matches an exact array element', () => {
    const fields = [f('Tags', '["prod","pci"]', true), f('Flag')];
    const rules: Rule[] = [{ conditions: [{ name: 'Tags', state: RuleState.Contains, value: 'prod' }], targets: [{ name: 'Flag', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Flag')).toBe(true);
  });
});

// ============================================================================
// Numeric comparison predicates
// ============================================================================
describe('numeric comparison predicates', () => {
  it('a "< 1024" rule fires for port 443', () => {
    const fields = [f('Port', '443', true), f('Tls')];
    const rules: Rule[] = [{ conditions: [{ name: 'Port', state: RuleState.LessThan, value: '1024' }], targets: [{ name: 'Tls', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Tls')).toBe(true);
  });

  it('the same "< 1024" rule does NOT fire for port 8080', () => {
    const fields = [f('Port', '8080', true), f('Tls')];
    const rules: Rule[] = [{ conditions: [{ name: 'Port', state: RuleState.LessThan, value: '1024' }], targets: [{ name: 'Tls', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Tls')).toBe(false);
  });
});

// ============================================================================
// Cross-field comparisons (valueField)
// ============================================================================
describe('cross-field comparison (compare to another field)', () => {
  it('MinPort <= MaxPort holds when MinPort is smaller', () => {
    const fields = [f('MinPort', '80', true), f('MaxPort', '443', true), f('Ok')];
    const rules: Rule[] = [{ conditions: [{ name: 'MinPort', state: RuleState.LessOrEqual, valueField: 'MaxPort' }], targets: [{ name: 'Ok', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Ok')).toBe(true);
  });

  it('MinPort <= MaxPort fails when MinPort is larger', () => {
    const fields = [f('MinPort', '8080', true), f('MaxPort', '443', true), f('Ok')];
    const rules: Rule[] = [{ conditions: [{ name: 'MinPort', state: RuleState.LessOrEqual, valueField: 'MaxPort' }], targets: [{ name: 'Ok', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Ok')).toBe(false);
  });

  it('set_to_value can match another field (Password === Confirm)', () => {
    const fields = [f('Password', 'hunter2', true), f('Confirm', 'hunter2', true), f('Ok')];
    const rules: Rule[] = [{ conditions: [{ name: 'Password', state: RuleState.SetToValue, valueField: 'Confirm' }], targets: [{ name: 'Ok', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Ok')).toBe(true);
  });
});

// ============================================================================
// OR conditions (rule.match = 'any')
// ============================================================================
describe('conditions can combine with OR (match: any)', () => {
  const rule = (): Rule => ({
    match: 'any',
    conditions: [
      { name: 'A', state: RuleState.Set },
      { name: 'B', state: RuleState.Set },
    ],
    targets: [{ name: 'X', state: RuleState.Set }],
  });

  it('fires when only one of the conditions holds', () => {
    const fields = [f('A', 'yes', true), f('B'), f('X')];
    expect(checkedOf(applyRules(fields, [rule()]).updatedFields, 'X')).toBe(true);
  });

  it('does NOT fire when none hold', () => {
    const fields = [f('A'), f('B'), f('X')];
    expect(checkedOf(applyRules(fields, [rule()]).updatedFields, 'X')).toBe(false);
  });

  it('with default match (all), the same conditions require BOTH', () => {
    const fields = [f('A', 'yes', true), f('B'), f('X')];
    const andRule: Rule = { ...rule(), match: undefined };
    expect(checkedOf(applyRules(fields, [andRule]).updatedFields, 'X')).toBe(false);
  });
});

// ============================================================================
// Roadmap: guarantees not yet implemented (Tier 1-3)
// ============================================================================
describe('roadmap: expressiveness not yet supported', () => {
  it.todo('cardinality: "exactly one of A/B/C" and "at least one of A/B"');
  it.todo('dynamic arrays: govern an unbounded list of objects, not fixed indices');
});

describe('roadmap: formal guarantees (need a solver + richer result type)', () => {
  it.todo('satisfiability: flag a template whose rules no config can satisfy (dead template)');
  it.todo('completeness: prove every field is reachable / no rule is dead code');
  it.todo('confluence proof: certify a ruleset converges to a unique result, or name the divergent rules');
});

describe('roadmap: help you fix it, not just judge it', () => {
  it.todo('auto-repair: given an invalid config, return the minimal edit that makes it valid');
  it.todo('explain: "why is field X required?" returns the exact rule chain that forced it');
  it.todo('provenance: every resolved value is tagged with its origin (default | rule | inherited | user)');
  it.todo('rule inference: derive a candidate ruleset from a corpus of known-good configs');
});

describe('roadmap: scope beyond one file', () => {
  it.todo('schema evolution: migrate existing configs from template v1 -> v2 and flag breaking changes');
  it.todo('cross-service constraints: "service A.port must equal service B.upstreamPort"');
  it.todo('secret-aware fields: never persist plaintext; validate against a vault reference');
  it.todo('environment overlays: prove prod config is a valid specialization of the base');
});
