import { RuleState, Rule, RuleDomain } from '@guido/types';
import type { Field, CardinalityConstraint } from '@guido/types';
import { validateValue, translateRangeToHumanReadable } from './fieldUtils.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface DependencyNode {
  name: string;
  state: RuleState;
  value?: string;
  not?: boolean;
  dependencies: DependencyNode[];
}

function buildDependencyGraph(rules: Rule[]): Map<string, DependencyNode> {
  const graph = new Map<string, DependencyNode>();

  rules.forEach(rule => {
    rule.conditions?.forEach((condition: RuleDomain) => {
      if (!graph.has(condition.name)) {
        graph.set(condition.name, { ...condition, dependencies: [] });
      }
      const conditionNode = graph.get(condition.name)!;

      rule.targets.forEach((target: RuleDomain) => {
        // Skip self-referencing rules (e.g., "if X is set, set X to value Y")
        // These are valid default value rules, not circular dependencies
        if (condition.name === target.name) {
          return;
        }
        
        if (!graph.has(target.name)) {
          graph.set(target.name, { ...target, dependencies: [] });
        }
        const targetNode = graph.get(target.name)!;
        
        // Avoid duplicate dependencies
        if (!conditionNode.dependencies.some(d => d.name === target.name)) {
          conditionNode.dependencies.push(targetNode);
        }
      });
    });
  });

  return graph;
}
function detectCircularDependencies(graph: Map<string, DependencyNode>): string[] {
  const errors: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeName: string, path: string[]): boolean {
    if (recursionStack.has(nodeName)) {
      const cycleStart = path.indexOf(nodeName);
      const cycle = path.slice(cycleStart).concat(nodeName);
      errors.push(`Circular dependency detected: ${cycle.join(' → ')}`);
      return true;
    }

    if (visited.has(nodeName)) {
      return false;
    }

    visited.add(nodeName);
    recursionStack.add(nodeName);
    path.push(nodeName);

    const node = graph.get(nodeName);
    if (node) {
      for (const dep of node.dependencies) {
        if (dfs(dep.name, [...path])) {
          // Cycle detected, already added to errors
        }
      }
    }

    recursionStack.delete(nodeName);
    return false;
  }

  graph.forEach((_, nodeName) => {
    if (!visited.has(nodeName)) {
      dfs(nodeName, []);
    }
  });

  return errors;
}

/**
 * Check if two rules form a contrapositive pair (logically equivalent, stable pattern)
 * Example: 
 *   Rule 1: If A is set → B is not set
 *   Rule 2: If B is not set → A is set
 * These are contrapositives and form a stable, non-infinite loop
 */
function areContrapositives(rule1: Rule, rule2: Rule): boolean {
  if (!rule1.conditions || !rule2.conditions) return false;
  if (rule1.conditions.length === 0 || rule2.conditions.length === 0) return false;

  // Check if rule1's targets appear in rule2's conditions (with opposite not flag)
  // and rule2's targets appear in rule1's conditions (with opposite not flag)
  
  // Get all field names involved
  const rule1ConditionFields = new Set(rule1.conditions.map((c: RuleDomain) => c.name));
  const rule2ConditionFields = new Set(rule2.conditions.map((c: RuleDomain) => c.name));

  // For contrapositive: rule1 targets should relate to rule2 conditions
  // and rule2 targets should relate to rule1 conditions
  const rule1TargetsInRule2Conditions = rule1.targets.some((t: RuleDomain) => rule2ConditionFields.has(t.name));
  const rule2TargetsInRule1Conditions = rule2.targets.some((t: RuleDomain) => rule1ConditionFields.has(t.name));

  if (!rule1TargetsInRule2Conditions || !rule2TargetsInRule1Conditions) {
    return false;
  }

  // Check that the conditions are logically opposite (contrapositive relationship)
  // Rule 1: If A is set → B is NOT set
  // Rule 2: If B is NOT set → A is set
  // The key insight: if both rules fire, the system reaches a stable state
  
  // For now, we'll consider it a contrapositive if:
  // 1. Rule1's targets with not=true appear in Rule2's conditions with not=true (same state)
  // 2. Rule2's targets with not=false appear in Rule1's conditions with not=false (same state)
  // OR the reverse pattern
  
  for (const target1 of rule1.targets) {
    const matchingCondition2 = rule2.conditions.find((c: RuleDomain) => c.name === target1.name);
    if (matchingCondition2) {
      // The target should cause the condition to be satisfied
      // If target says "set not=true" (unset), condition should check "not=true" (is not set)
      // This is a stable pattern
      if (target1.not === matchingCondition2.not && target1.state === RuleState.Set && matchingCondition2.state === RuleState.Set) {
        // Found a consistent link
        for (const target2 of rule2.targets) {
          const matchingCondition1 = rule1.conditions.find((c: RuleDomain) => c.name === target2.name);
          if (matchingCondition1) {
            // Check for opposite relationship
            if (target2.not !== matchingCondition1.not && target2.state === RuleState.Set && matchingCondition1.state === RuleState.Set) {
              return true; // This is a contrapositive pair
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Filter out circular dependency errors that are actually safe contrapositive patterns
 */
function filterContrapositiveCycles(circularErrors: string[], rules: Rule[]): string[] {
  if (circularErrors.length === 0) return [];

  // Find all contrapositive rule pairs
  const contrapositivePairs: Set<string> = new Set();
  
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      if (areContrapositives(rules[i], rules[j])) {
        // Mark all fields involved in this contrapositive relationship
        rules[i].conditions?.forEach((c: RuleDomain) => contrapositivePairs.add(c.name));
        rules[i].targets.forEach((t: RuleDomain) => contrapositivePairs.add(t.name));
        rules[j].conditions?.forEach((c: RuleDomain) => contrapositivePairs.add(c.name));
        rules[j].targets.forEach((t: RuleDomain) => contrapositivePairs.add(t.name));
      }
    }
  }

  // Filter out errors where all fields in the cycle are part of a contrapositive relationship
  return circularErrors.filter(error => {
    // Extract field names from error message like "Circular dependency detected: A → B → A"
    const match = error.match(/Circular dependency detected: (.+)/);
    if (!match) return true;
    
    const fields = match[1].split(' → ').map(f => f.trim());
    
    // If all fields in this cycle are part of contrapositive pairs, filter it out
    const allFieldsInContrapositive = fields.every(field => contrapositivePairs.has(field));
    
    return !allFieldsInContrapositive;
  });
}

/**
 * Do two conditions on the SAME field contradict, i.e. can they never both hold?
 * This is the theory-level satisfiability check for a single field's predicates.
 */
function fieldConditionsConflict(c1: RuleDomain, c2: RuleDomain): boolean {
  const positiveValue = (c: RuleDomain) => c.state === RuleState.SetToValue && !c.not;
  const negatedSet = (c: RuleDomain) => c.state === RuleState.Set && c.not === true;

  // "set" and "not set"
  if (c1.state === RuleState.Set && c2.state === RuleState.Set && c1.not !== c2.not) return true;
  // "= v1" and "= v2" with v1 != v2
  if (positiveValue(c1) && positiveValue(c2) && c1.value !== c2.value) return true;
  // "= v" and "!= v"
  if (c1.state === RuleState.SetToValue && c2.state === RuleState.SetToValue && c1.value === c2.value && c1.not !== c2.not) return true;
  // "= v" implies the field is set, which contradicts "not set"
  if ((positiveValue(c1) && negatedSet(c2)) || (positiveValue(c2) && negatedSet(c1))) return true;
  // "contains v" and "does not contain v"
  if (c1.state === RuleState.Contains && c2.state === RuleState.Contains && c1.value === c2.value && c1.not !== c2.not) return true;
  return false;
}

/**
 * Can two rules' conditions be satisfied simultaneously? They can UNLESS they force a
 * shared field into conflicting requirements. This satisfiability check is what lets us
 * catch contradictions between rules whose conditions merely OVERLAP (e.g. "A=1" and
 * "A=1 AND B=2"), which the old identical-signature grouping missed.
 */
function conditionsCanCoOccur(a: RuleDomain[] = [], b: RuleDomain[] = []): boolean {
  const combined = [...a, ...b];
  for (let i = 0; i < combined.length; i++) {
    for (let j = i + 1; j < combined.length; j++) {
      if (combined[i].name === combined[j].name && fieldConditionsConflict(combined[i], combined[j])) {
        return false;
      }
    }
  }
  return true;
}

/** The conflict message for two targets on the same field, or null when compatible. */
function targetConflictMessage(t1: RuleDomain, t2: RuleDomain): string | null {
  if (t1.not !== t2.not) {
    return `Contradiction detected for field "${t1.name}": cannot be both required (not=${t1.not}) and not required (not=${t2.not}) under the same conditions`;
  }
  if (t1.state !== t2.state) {
    return `Contradiction detected for field "${t1.name}": has conflicting states (${t1.state} vs ${t2.state}) under the same conditions`;
  }
  // set_to_value with different values conflict; contains values are additive.
  if (t1.state === RuleState.SetToValue && t1.value !== t2.value) {
    return `Contradiction detected for field "${t1.name}": has conflicting values ("${t1.value}" vs "${t2.value}") under the same conditions`;
  }
  return null;
}

/** A detected contradiction plus the config assignment (witness) that triggers it. */
export interface Contradiction {
  /** Human-readable description of the conflict. */
  message: string;
  /**
   * A minimal field assignment under which both conflicting rules fire, so the user can
   * reproduce the conflict. `<set>` marks a field that only needs to be enabled (no value).
   */
  witness: Record<string, string>;
}

/** Build the witnessing assignment that satisfies a set of (positive) conditions. */
function conditionWitness(conditions: RuleDomain[]): Record<string, string> {
  const witness: Record<string, string> = {};
  for (const c of conditions) {
    if (c.not) continue;
    if (c.state === RuleState.SetToValue && c.value !== undefined) witness[c.name] = c.value;
    else if (c.state === RuleState.Contains && c.value !== undefined) witness[c.name] = c.value;
    else if (c.state === RuleState.Set) witness[c.name] = '<set>';
  }
  return witness;
}

/**
 * Find contradictions between any two rules whose conditions CAN co-occur: if both rules
 * can fire together they must not impose conflicting targets on the same field. Each result
 * carries a {@link Contradiction.witness} - the assignment that makes both rules fire - so
 * the conflict is reproducible, not just asserted. Generalizes the old identical-condition
 * check to overlapping conditions via the {@link conditionsCanCoOccur} satisfiability test.
 */
export function findContradictions(rules: Rule[]): Contradiction[] {
  const found: Contradiction[] = [];
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      // The co-occurrence check assumes conditions are ANDed; skip OR-matched rules.
      if (rules[i].match === 'any' || rules[j].match === 'any') continue;
      if (!conditionsCanCoOccur(rules[i].conditions, rules[j].conditions)) continue;
      for (const t1 of rules[i].targets) {
        for (const t2 of rules[j].targets) {
          if (t1.name !== t2.name) continue;
          const message = targetConflictMessage(t1, t2);
          if (message) {
            found.push({
              message,
              witness: conditionWitness([...(rules[i].conditions ?? []), ...(rules[j].conditions ?? [])]),
            });
          }
        }
      }
    }
  }
  return found;
}

function detectContradictions(rules: Rule[]): string[] {
  return findContradictions(rules).map((c) => c.message);
}

function detectRuleContradictions(rules: Rule[]): string[] {
  const contradictions: string[] = [];

  rules.forEach((rule, index) => {
    const conditionMap = new Map<string, { state: RuleState, not?: boolean }>();
    const targetMap = new Map<string, { state: RuleState, not?: boolean }>();

    rule.conditions?.forEach((condition: RuleDomain) => {
      const existingCondition = conditionMap.get(condition.name);
      if (existingCondition) {
        if (existingCondition.state !== condition.state || existingCondition.not !== condition.not) {
          contradictions.push(`Contradiction detected in rule ${index + 1} involving condition ${condition.name}`);
        }
      } else {
        conditionMap.set(condition.name, { state: condition.state, not: condition.not });
      }
    });

    rule.targets.forEach((target: RuleDomain) => {
      const existingTarget = targetMap.get(target.name);
      if (existingTarget) {
        if (existingTarget.state !== target.state || existingTarget.not !== target.not) {
          contradictions.push(`Contradiction detected in rule ${index + 1} involving target ${target.name}`);
        }
      } else {
        targetMap.set(target.name, { state: target.state, not: target.not });
      }
    });
  });

  return contradictions;
}

function suggestRuleMerges(rules: Rule[]): string[] {
  const mergeSuggestions: string[] = [];
  const noConditionRules: { targets: RuleDomain[], ruleIndex: number }[] = [];
  const conditionMap = new Map<string, { targets: RuleDomain[], ruleIndex: number }[]>();

  rules.forEach((rule, index) => {
    if (!rule.conditions || rule.conditions.length === 0) {
      noConditionRules.push({ targets: rule.targets, ruleIndex: index });
    } else {
      const conditionKey = JSON.stringify(rule.conditions.map((cond: RuleDomain) => ({
        name: cond.name,
        state: cond.state,
        not: cond.not,
        value: cond.value // Include value in the condition key
      })));
      if (!conditionMap.has(conditionKey)) {
        conditionMap.set(conditionKey, []);
      }
      conditionMap.get(conditionKey)!.push({ targets: rule.targets, ruleIndex: index });
    }
  });

  if (noConditionRules.length > 1) {
    mergeSuggestions.push(`Rules ${noConditionRules.map(entry => entry.ruleIndex + 1).join(', ')} can be merged as they have no conditions.`);
  }

  conditionMap.forEach((entries) => {
    if (entries.length > 1) {
      // Check if targets have contradictions before suggesting merge
      let hasContradiction = false;
      const targetMap = new Map<string, { state: RuleState, not?: boolean, value?: string }[]>();

      entries.forEach(entry => {
        entry.targets.forEach(target => {
          if (!targetMap.has(target.name)) {
            targetMap.set(target.name, []);
          }
          targetMap.get(target.name)!.push({ state: target.state, not: target.not, value: target.value });
        });
      });

      // Check for contradictions in targets
      targetMap.forEach((targets) => {
        for (let i = 0; i < targets.length; i++) {
          for (let j = i + 1; j < targets.length; j++) {
            const t1 = targets[i];
            const t2 = targets[j];
            // Check for not-flag contradiction
            if (t1.not !== t2.not) {
              hasContradiction = true;
            }
            // Check for state contradiction
            else if (t1.state !== t2.state) {
              hasContradiction = true;
            }
            // Check for value contradiction
            else if ((t1.state === RuleState.SetToValue || t1.state === RuleState.Contains) && t1.value !== t2.value) {
              hasContradiction = true;
            }
          }
        }
      });

      if (!hasContradiction) {
        mergeSuggestions.push(`Rules ${entries.map(entry => entry.ruleIndex + 1).join(', ')} can be merged as they have identical conditions.`);
      }
    }
  });

  return mergeSuggestions;
}
export function validateRules(rules: Rule[]): ValidationResult {
  const graph = buildDependencyGraph(rules);
  const circularErrors = detectCircularDependencies(graph);
  // Filter out safe contrapositive cycles
  const filteredCircularErrors = filterContrapositiveCycles(circularErrors, rules);
  const graphErrors = detectContradictions(rules);
  const ruleContradictions = detectRuleContradictions(rules);
  const mergeSuggestions = suggestRuleMerges(rules);

  // Errors are actual problems that need fixing
  const errors = [...filteredCircularErrors, ...graphErrors, ...ruleContradictions];
  // Warnings are suggestions/hints (like merge suggestions)
  const warnings = [...mergeSuggestions];

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a ruleset for CONSISTENCY WITH the field schema it targets: a rule must never
 * assign (or condition on) a concrete value that its target field's own range forbids.
 * Such a rule is a template authoring bug: a target sets config the schema rejects, and a
 * condition that can never be true is dead code.
 *
 * Only `set_to_value` domains carry a concrete value to check; `set`/`contains` and negated
 * (`not`) domains do not pin a single value. Fields with no range (or plain `string`) are
 * unconstrained and skipped.
 */
export function validateRulesAgainstFields(rules: Rule[], fields: Field[]): ValidationResult {
  const errors: string[] = [];
  const rangeByName = new Map<string, string>();
  for (const field of fields) {
    if (field.range && field.range !== 'string') rangeByName.set(field.name, field.range);
  }

  const check = (domain: RuleDomain, role: 'target' | 'condition'): void => {
    // Only literal set_to_value values are range-checkable; cross-field (valueField) compares
    // against another field, not a literal, so it has nothing to validate here.
    if (domain.state !== RuleState.SetToValue || domain.not || domain.value === undefined || domain.valueField !== undefined) return;
    const range = rangeByName.get(domain.name);
    if (!range || validateValue(domain.value, range)) return;
    const human = translateRangeToHumanReadable(range);
    errors.push(
      role === 'target'
        ? `Rule sets "${domain.name}" to "${domain.value}", which its range forbids (expected: ${human}).`
        : `Rule condition requires "${domain.name}" = "${domain.value}", which its range forbids (expected: ${human}); this condition can never be met.`,
    );
  };

  for (const rule of rules) {
    rule.targets.forEach((t) => check(t, 'target'));
    (rule.conditions ?? []).forEach((c) => check(c, 'condition'));
  }

  return { isValid: errors.length === 0, errors, warnings: [] };
}
/** A field counts as "set" for cardinality: enabled with a non-empty value. */
function isSet(field: Field | undefined): boolean {
  if (!field || field.checked !== true) return false;
  const v = field.value;
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Validate cardinality constraints against the current field values: each constraint
 * counts how many of its fields are set and checks the required cardinality
 * ('exactly-one' == 1, 'at-least-one' >= 1, 'at-most-one' <= 1).
 */
export function validateCardinality(constraints: CardinalityConstraint[], fields: Field[]): ValidationResult {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const errors: string[] = [];
  for (const c of constraints) {
    const setCount = c.fields.filter((name) => isSet(byName.get(name))).length;
    const label = c.fields.map((f) => `"${f}"`).join(', ');
    if (c.kind === 'exactly-one' && setCount !== 1) {
      errors.push(`Exactly one of ${label} must be set, but ${setCount} are.`);
    } else if (c.kind === 'at-least-one' && setCount < 1) {
      errors.push(`At least one of ${label} must be set, but none are.`);
    } else if (c.kind === 'at-most-one' && setCount > 1) {
      errors.push(`At most one of ${label} may be set, but ${setCount} are.`);
    }
  }
  return { isValid: errors.length === 0, errors, warnings: [] };
}
