/**
 * DREAM ENGINE DISCOVERY SPEC
 *
 * These tests encode how the *ideal* Guido engine should behave ("cannot get
 * config wrong"). They are run against the CURRENT engine to discover real gaps
 * empirically instead of by code-reading. A FAIL here = a real gap in today's
 * engine. A PASS = the engine already does the right thing.
 *
 * Not part of the CI suite; run explicitly with:
 *   npx vitest run packages/core/src/dream-engine.discovery.test.ts
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
// GROUP 1 — Rule propagation reaches a FIXPOINT (order-independent chaining)
// ============================================================================
describe('DREAM: rule propagation converges regardless of rule order', () => {
  it('[fair] single rule fires when its condition holds', () => {
    const fields = [f('A', 'true', true), f('B')];
    const rules: Rule[] = [{ conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.SetToValue, value: 'x' }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'B')).toBe(true);
  });

  it('[fair] 2-hop chain propagates when rules are in dependency order', () => {
    const fields = [f('A', 'true', true), f('B'), f('C')];
    const rules: Rule[] = [
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.SetToValue, value: 'x' }] },
      { conditions: [{ name: 'B', state: RuleState.Set }], targets: [{ name: 'C', state: RuleState.SetToValue, value: 'y' }] },
    ];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'C')).toBe(true);
  });

  it('[dream] 2-hop chain propagates even when rules are in REVERSE order', () => {
    const fields = [f('A', 'true', true), f('B'), f('C')];
    const rules: Rule[] = [
      // C-rule listed BEFORE the B-rule that satisfies its condition
      { conditions: [{ name: 'B', state: RuleState.Set }], targets: [{ name: 'C', state: RuleState.SetToValue, value: 'y' }] },
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.SetToValue, value: 'x' }] },
    ];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'C')).toBe(true);
  });

  it('[dream] deep chain converges (A->B->C->D) irrespective of order', () => {
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
// GROUP 2 — Contradiction detection is LOGICAL, not just syntactic
// ============================================================================
describe('DREAM: contradiction detection catches real conflicts', () => {
  it('[fair] conflicting unconditional targets on the same field are flagged', () => {
    const rules: Rule[] = [
      { conditions: [], targets: [{ name: 'X', state: RuleState.Set }] },
      { conditions: [], targets: [{ name: 'X', state: RuleState.Set, not: true }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  it('[fair] same-condition rules assigning different values are flagged', () => {
    const rules: Rule[] = [
      { conditions: [], targets: [{ name: 'X', state: RuleState.SetToValue, value: 'a' }] },
      { conditions: [], targets: [{ name: 'X', state: RuleState.SetToValue, value: 'b' }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  it('[dream] conflict under OVERLAPPING (superset) conditions is flagged', () => {
    // When A=1 AND B=2, rule 1 requires X and rule 2 forbids X -> contradiction.
    const rules: Rule[] = [
      { conditions: [{ name: 'A', state: RuleState.SetToValue, value: '1' }], targets: [{ name: 'X', state: RuleState.Set }] },
      { conditions: [{ name: 'A', state: RuleState.SetToValue, value: '1' }, { name: 'B', state: RuleState.SetToValue, value: '2' }], targets: [{ name: 'X', state: RuleState.Set, not: true }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  it('[dream] unconditional requirement vs conditional prohibition is flagged', () => {
    // X is always required, but when A is set X is forbidden -> unsatisfiable when A set.
    const rules: Rule[] = [
      { conditions: [], targets: [{ name: 'X', state: RuleState.Set }] },
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'X', state: RuleState.Set, not: true }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });
});

// ============================================================================
// GROUP 3 — Cycle detection reasons about SATISFIABILITY, not just name graph
// ============================================================================
describe('DREAM: cycle detection distinguishes real loops from benign coupling', () => {
  it('[fair] a genuine 3-node cycle is reported', () => {
    const rules: Rule[] = [
      { conditions: [{ name: 'A', state: RuleState.Set }], targets: [{ name: 'B', state: RuleState.Set }] },
      { conditions: [{ name: 'B', state: RuleState.Set }], targets: [{ name: 'C', state: RuleState.Set }] },
      { conditions: [{ name: 'C', state: RuleState.Set }], targets: [{ name: 'A', state: RuleState.Set }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  // NOTE: "benign mutual implication (A<->B) should be valid" was removed as a contested
  // design change. The engine intentionally treats A<->B as circular (see the committed
  // validateRules cycle tests); redefining that is a product decision, not a bug.
});

// ============================================================================
// GROUP 4 — Value validation is SOUND
// ============================================================================
describe('DREAM: value validation is sound', () => {
  it('[fair] integer out of range is rejected', () => {
    expect(validateValue('999', 'integer(1..100)')).toBe(false);
  });
  it('[fair] valid integer in range is accepted', () => {
    expect(validateValue('50', 'integer(1..100)')).toBe(true);
  });
  it('[dream] empty string is NOT a valid integer', () => {
    expect(validateValue('', 'integer')).toBe(false);
  });
  it('[dream] whitespace-only string is NOT a valid integer', () => {
    expect(validateValue('   ', 'integer')).toBe(false);
  });
  it('[dream] a plain number is NOT valid for an enum of specific strings', () => {
    expect(validateValue('prod', 'dev||staging||prod')).toBe(true); // fair sanity
    expect(validateValue('production', 'dev||staging||prod')).toBe(false);
  });
});

// ============================================================================
// GROUP 5 — Rules must be CONSISTENT WITH the field schema they target
// ============================================================================
describe('DREAM: engine catches rules that produce schema-invalid config', () => {
  it('[dream] a rule that sets a value violating the target field range is flagged', () => {
    // Port must be 1..65535, but a rule forces it to 999999. The engine should flag this
    // rule/schema conflict at validation time rather than silently produce invalid config.
    const fields = [f('Port', '', false, 'integer(1..65535)')];
    const rules: Rule[] = [{ conditions: [], targets: [{ name: 'Port', state: RuleState.SetToValue, value: '999999' }] }];
    expect(validateRulesAgainstFields(rules, fields).isValid).toBe(false);
  });
});

// ============================================================================
// GROUP 6 — "Contains" predicate semantics
// ============================================================================
describe('DREAM: Contains means membership, not accidental substring', () => {
  it('[dream] ContainsItem is membership, not substring: does NOT match "production"', () => {
    const fields = [f('Env', 'production', true), f('Flag')];
    const rules: Rule[] = [{ conditions: [{ name: 'Env', state: RuleState.ContainsItem, value: 'prod' }], targets: [{ name: 'Flag', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Flag')).toBe(false);
  });

  it('[fair] legacy Contains keeps its substring behavior (unchanged, not silently broken)', () => {
    const fields = [f('Env', 'production', true), f('Flag')];
    const rules: Rule[] = [{ conditions: [{ name: 'Env', state: RuleState.Contains, value: 'prod' }], targets: [{ name: 'Flag', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Flag')).toBe(true);
  });
});

// ============================================================================
// GROUP 7 — Rule-language expressiveness the DSL currently lacks
// ============================================================================
describe('DREAM: rule language can express real config constraints', () => {
  it('[dream] numeric threshold: a "< 1024" rule fires for port 443', () => {
    const fields = [f('Port', '443', true), f('Tls')];
    const rules: Rule[] = [{ conditions: [{ name: 'Port', state: RuleState.LessThan, value: '1024' }], targets: [{ name: 'Tls', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Tls')).toBe(true);
  });

  it('[dream] numeric threshold: the same "< 1024" rule does NOT fire for port 8080', () => {
    const fields = [f('Port', '8080', true), f('Tls')];
    const rules: Rule[] = [{ conditions: [{ name: 'Port', state: RuleState.LessThan, value: '1024' }], targets: [{ name: 'Tls', state: RuleState.Set }] }];
    expect(checkedOf(applyRules(fields, rules).updatedFields, 'Tls')).toBe(false);
  });

  // Documented gaps with no clean unit expression against today's API (roadmap markers):
  it.todo('[dream] cross-field relations: "MinPort must be <= MaxPort"');
  it.todo('[dream] cardinality: "exactly one of A/B/C" and "at least one of A/B"');
  it.todo('[dream] dynamic arrays: govern an unbounded list of objects, not fixed indices');
});

// ============================================================================
// GROUP 8 — BIG DREAM: formal guarantees a category-defining engine would make
// (correctness is table stakes; these are what make "cannot get it wrong" true)
// ============================================================================
describe('DREAM (big): provable guarantees about a template', () => {
  it('[dream] non-confluence is flagged: conflicting unconditional assignments are invalid', () => {
    // Two rules that assign X differently make applyRules order-dependent. Rather than
    // silently pick a winner, the engine flags the ruleset as inconsistent (detect-and-flag).
    const rules: Rule[] = [
      { conditions: [], targets: [{ name: 'X', state: RuleState.SetToValue, value: 'a' }] },
      { conditions: [], targets: [{ name: 'X', state: RuleState.SetToValue, value: 'b' }] },
    ];
    expect(validateRules(rules).isValid).toBe(false);
  });

  // Guarantees that need a solver + a richer result type than today's string[] errors:
  it.todo('[dream] satisfiability: flag a template whose rules NO config can satisfy (dead template)');
  it.todo('[dream] completeness: prove every field is reachable / no rule is dead code');
  it('[dream] a contradiction returns a machine-readable COUNTEREXAMPLE (witnessing config)', () => {
    const rules: Rule[] = [
      { conditions: [{ name: 'A', state: RuleState.SetToValue, value: '1' }], targets: [{ name: 'X', state: RuleState.Set }] },
      { conditions: [{ name: 'A', state: RuleState.SetToValue, value: '1' }, { name: 'B', state: RuleState.SetToValue, value: '2' }], targets: [{ name: 'X', state: RuleState.Set, not: true }] },
    ];
    const found = findContradictions(rules);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].witness).toMatchObject({ A: '1', B: '2' });
  });
  it.todo('[dream] confluence PROOF: certify a ruleset converges to a unique result, or name the divergent rules');
});

// ============================================================================
// GROUP 9 — BIG DREAM: beyond pass/fail — repair, explanation, provenance
// ============================================================================
describe('DREAM (big): the engine helps you fix it, not just judge it', () => {
  it.todo('[dream] auto-repair: given an invalid config, return the MINIMAL edit that makes it valid');
  it.todo('[dream] explain: "why is field X required?" returns the exact rule chain that forced it');
  it.todo('[dream] provenance: every resolved value is tagged with its origin (default | rule | inherited | user)');
  it.todo('[dream] rule inference: derive a candidate ruleset from a corpus of known-good configs');
});

// ============================================================================
// GROUP 10 — BIG DREAM: scope beyond one file
// ============================================================================
describe('DREAM (big): govern config across versions, services, and secrets', () => {
  it.todo('[dream] schema evolution: migrate existing configs from template v1 -> v2 and flag breaking changes');
  it.todo('[dream] cross-service constraints: "service A.port must equal service B.upstreamPort"');
  it.todo('[dream] secret-aware fields: never persist plaintext; validate against a vault reference');
  it.todo('[dream] environment overlays: prove prod config is a valid specialization of the base');
});
