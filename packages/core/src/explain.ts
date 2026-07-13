/**
 * @guido/core - Explain
 *
 * Answers "why is field X in its current state?" by tracing the rule chain that forced
 * it, back to the root-cause inputs. Reuses the resolved state from applyRules, the
 * condition evaluator (checkCondition), and the human-readable rule/condition renderers.
 */
import type { Field, Rule, RuleDomain } from '@guido/types';
import { RuleState } from '@guido/types';
import { applyRules, checkCondition } from './applyRules.js';
import { translateRule, describeCondition } from './ruleTranslation.js';

/** Where a satisfied condition's truth comes from. */
export type ConditionSource = 'rule' | 'input';

export interface ConditionTrace {
  /** Human-readable condition, e.g. "'Repository' is set to the value 'MongoDb'". */
  text: string;
  /** 'rule' when another rule forced the condition field (recurse into `chain`); 'input' when it came from the config as given. */
  satisfiedBy: ConditionSource;
  /** Present when satisfiedBy === 'rule': the explanation for the condition field. */
  chain?: Explanation;
}

export interface ExplanationStep {
  /** 1-based rule number (matches list_rules / validation messages). */
  ruleIndex: number;
  /** The rule rendered as prose. */
  rule: string;
  /** Why this rule fired. */
  conditions: ConditionTrace[];
}

export type ExplanationOutcome =
  | 'required'
  | 'set_to_value'
  | 'must_contain'
  | 'forbidden'
  | 'unconstrained';

export interface Explanation {
  field: string;
  outcome: ExplanationOutcome;
  /** Present when outcome === 'set_to_value'. */
  value?: string;
  /** The rules that forced the field into its state; empty when nothing constrains it. */
  because: ExplanationStep[];
}

/** Map a target domain to the outcome it imposes on its field. */
function outcomeOf(target: RuleDomain): ExplanationOutcome {
  switch (target.state) {
    case RuleState.Set: return target.not ? 'forbidden' : 'required';
    case RuleState.SetToValue: return 'set_to_value';
    case RuleState.Contains: return 'must_contain';
    default: return 'unconstrained';
  }
}

/** Whether all of a rule's conditions hold in the given (resolved) field state. */
function conditionsHold(rule: Rule, fieldMap: Map<string, Field>): boolean {
  if (!rule.conditions || rule.conditions.length === 0) return true;
  const evalC = (c: RuleDomain): boolean => {
    const field = fieldMap.get(c.name);
    const met = field ? checkCondition(field, c, fieldMap) : false;
    return c.not ? !met : met;
  };
  return rule.match === 'any' ? rule.conditions.some(evalC) : rule.conditions.every(evalC);
}

/** Whether some rule forces `fieldName` given the resolved state (drives the source classification). */
function isRuleDriven(fieldName: string, rules: Rule[], fieldMap: Map<string, Field>): boolean {
  return rules.some((r) => r.targets.some((t) => t.name === fieldName) && conditionsHold(r, fieldMap));
}

function explainResolved(
  fieldName: string,
  fieldMap: Map<string, Field>,
  rules: Rule[],
  visited: Set<string>,
): Explanation {
  if (visited.has(fieldName)) {
    // Cycle guard: report the field without re-expanding it.
    return { field: fieldName, outcome: 'unconstrained', because: [] };
  }
  visited.add(fieldName);

  const because: ExplanationStep[] = [];
  let outcome: ExplanationOutcome = 'unconstrained';
  let value: string | undefined;

  rules.forEach((rule, i) => {
    const target = rule.targets.find((t) => t.name === fieldName);
    if (!target || !conditionsHold(rule, fieldMap)) return;

    outcome = outcomeOf(target);
    if (target.state === RuleState.SetToValue) value = target.value;

    const conditions: ConditionTrace[] = (rule.conditions ?? []).map((c) => {
      const text = describeCondition(c);
      if (isRuleDriven(c.name, rules, fieldMap) && !visited.has(c.name)) {
        return { text, satisfiedBy: 'rule', chain: explainResolved(c.name, fieldMap, rules, visited) };
      }
      return { text, satisfiedBy: 'input' };
    });

    because.push({ ruleIndex: i + 1, rule: translateRule(rule, fieldName), conditions });
  });

  return { field: fieldName, outcome, value, because };
}

/**
 * Explain why `fieldName` is in its current state, given the fields (current config) and
 * rules. Resolves the ruleset to a fixpoint first, then traces each forcing rule and its
 * conditions down to the root-cause inputs. Recursion is cycle-guarded.
 */
export function explainField(fieldName: string, fields: Field[], rules: Rule[] = []): Explanation {
  const { updatedFields } = applyRules(fields, rules);
  const fieldMap = new Map(updatedFields.map((f) => [f.name, f]));
  return explainResolved(fieldName, fieldMap, rules, new Set<string>());
}
