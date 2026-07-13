/**
 * @guido/core - Apply Rules
 * 
 * Core rule application logic for evaluating and applying rules to fields.
 */

import type { Field, FieldValue, Rule, RuleDomain } from '@guido/types';
import { RuleState } from '@guido/types';
import type { ILogger, FieldChange, TriggerAction } from '@guido/logger';
import { logger } from '@guido/logger';
import { translateRule } from './ruleTranslation';

export interface ApplyRulesResult {
  updatedFields: Field[];
  disabledReasons: { [key: string]: string };
}

export interface ApplyRulesOptions {
  /** Logger instance to use. Defaults to the global logger from @guido/logger */
  logger?: ILogger;
  /** What triggered this rule application */
  trigger?: TriggerAction;
  /** Original field states before user action (for tracking user changes) */
  originalFields?: Field[];
}

/**
 * Apply rules to fields and track all changes
 * 
 * @param fields - The current field states (after user action)
 * @param rules - Rules to apply
 * @param options - Optional configuration
 */
export const applyRules = (
  fields: Field[], 
  rules: Rule[] = [], 
  options: ApplyRulesOptions = {}
): ApplyRulesResult => {
  const { 
    logger: log = logger, 
    trigger,
    originalFields 
  } = options;

  const updatedFields = [...fields];
  const disabledReasons: { [key: string]: string } = {};
  const fieldChanges: FieldChange[] = [];

  // Create a lookup map for O(1) field access instead of O(n) find()
  const fieldMap = new Map<string, Field>();
  updatedFields.forEach(field => fieldMap.set(field.name, field));

  // Include the user's triggering action as the first change(s)
  if (trigger && originalFields) {
    // For bulk actions (check_all/uncheck_all), track all changed fields
    if (trigger.type === 'check_all' || trigger.type === 'uncheck_all') {
      originalFields.forEach((origField) => {
        const newField = fieldMap.get(origField.name);
        if (newField && origField.checked !== newField.checked) {
          fieldChanges.push({
            fieldName: origField.name,
            property: 'checked',
            oldValue: origField.checked,
            newValue: newField.checked,
            reason: trigger.type === 'check_all' ? 'Checked all fields' : 'Unchecked all fields'
          });
        }
      });
    }
  } else if (trigger && trigger.fieldName && trigger.oldValue !== trigger.newValue) {
    // For single field actions (user or AI)
    const isUndoableAction = ['field_check', 'field_uncheck', 'field_value_change', 'ai_change'].includes(trigger.type);
    if (isUndoableAction) {
      const isAI = trigger.type === 'ai_change';
      const reason = isAI 
        ? `AI: ${(trigger as { aiTool?: string }).aiTool || 'changed field'}`
        : 'User action';
      fieldChanges.push({
        fieldName: trigger.fieldName,
        property: trigger.type === 'field_value_change' || isAI ? 'value' : 'checked',
        oldValue: trigger.oldValue,
        newValue: trigger.newValue,
        reason
      });
    }
  }

  // Iterate to a fixpoint so a rule whose condition is satisfied by another rule's
  // target propagates regardless of the order rules are listed in. Rule application
  // is idempotent (re-applying a satisfied rule is a no-op), so a pass that changes
  // nothing means convergence. Bounded by MAX_PASSES so oscillating/contradictory
  // rules terminate instead of looping forever.
  const MAX_PASSES = 50;
  const snapshot = (): string =>
    updatedFields.map((fld) => `${String(fld.checked)}:${JSON.stringify(fld.value)}`).join('|');
  let pass = 0;
  let before: string;
  do {
    before = snapshot();
    rules.forEach((rule) => {
    const conditionsMet =
      !rule.conditions ||
      rule.conditions.every((condition) => {
        const field = fieldMap.get(condition.name);
        const conditionMet = field ? checkCondition(field, condition, fieldMap) : checkChildConditionsFast(fieldMap, updatedFields, condition);
        return condition.not ? !conditionMet : conditionMet;
      });

    log.logRuleEvaluation(
      rule.targets.map(t => t.name).join(', '),
      conditionsMet,
      rule.conditions || []
    );

    if (conditionsMet) {
      rule.targets.forEach((target) => {
        const field = fieldMap.get(target.name);
        if (field) {
          const oldChecked = field.checked;
          const oldValue = field.value;
          applyTarget(field, target);
          const reason = translateRule(rule, target.name);
          disabledReasons[target.name] = reason;
          
          // Track changes
          if (oldChecked !== field.checked) {
            fieldChanges.push({
              fieldName: target.name,
              property: 'checked',
              oldValue: oldChecked,
              newValue: field.checked,
              reason
            });
          }
          if (oldValue !== field.value) {
            fieldChanges.push({
              fieldName: target.name,
              property: 'value',
              oldValue: oldValue,
              newValue: field.value,
              reason
            });
          }
        } else {
          const childFields = updatedFields.filter((f) => f.name.startsWith(target.name + '.'));
          childFields.forEach((childField) => {
            const oldChecked = childField.checked;
            const oldValue = childField.value;
            applyTarget(childField, target);
            const reason = translateRule(rule, target.name);
            disabledReasons[childField.name] = reason;
            
            // Track changes
            if (oldChecked !== childField.checked) {
              fieldChanges.push({
                fieldName: childField.name,
                property: 'checked',
                oldValue: oldChecked,
                newValue: childField.checked,
                reason
              });
            }
            if (oldValue !== childField.value) {
              fieldChanges.push({
                fieldName: childField.name,
                property: 'value',
                oldValue: oldValue,
                newValue: childField.value,
                reason
              });
            }
          });
        }
      });
    }
    });
    pass++;
  } while (before !== snapshot() && pass < MAX_PASSES);

  // Log all field changes
  log.logFieldChanges(fieldChanges, trigger);

  return { updatedFields, disabledReasons };
};

/**
 * Check if a condition is met for a field
 */
export const checkCondition = (field: Field, condition: RuleDomain, fieldMap?: Map<string, Field>): boolean => {
  const isChecked = field.checked ?? false;
  // Right-hand side of the comparison: another field's value (valueField) or the literal.
  const comparand: FieldValue | undefined =
    condition.valueField !== undefined ? fieldMap?.get(condition.valueField)?.value : condition.value;
  // Coerce a FieldValue to a plain scalar string for numeric parsing (arrays are not numeric).
  const toScalar = (v: FieldValue | undefined): string =>
    typeof v === 'number' ? String(v) : Array.isArray(v) ? '' : String(v ?? '');
  switch (condition.state) {
    case RuleState.Set:
      return field.value !== '' && isChecked;
    case RuleState.SetToValue:
      return isChecked && comparand !== undefined && field.value === comparand;
    case RuleState.Contains: {
      // Membership: the value is an array element, or (for a string field) an exact match.
      // Not a substring match - 'production' does NOT contain the item 'prod'.
      if (comparand === undefined || !isChecked) return false;
      const item = String(comparand);
      if (Array.isArray(field.value)) {
        return (field.value as (string | number)[]).map(String).includes(item);
      }
      if (typeof field.value === 'string') {
        try {
          const parsed: unknown = JSON.parse(field.value);
          if (Array.isArray(parsed)) return (parsed as (string | number)[]).map(String).includes(item);
        } catch { /* not JSON: fall through to exact match */ }
        return field.value === item;
      }
      return false;
    }
    case RuleState.GreaterThan:
    case RuleState.LessThan:
    case RuleState.GreaterOrEqual:
    case RuleState.LessOrEqual: {
      // Numeric comparison of the field value against the literal or the compared field.
      if (comparand === undefined || !isChecked) return false;
      const lhsRaw = toScalar(field.value);
      const rhsRaw = toScalar(comparand);
      if (lhsRaw.trim() === '' || rhsRaw.trim() === '') return false;
      const lhs = Number(lhsRaw);
      const rhs = Number(rhsRaw);
      if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) return false;
      if (condition.state === RuleState.GreaterThan) return lhs > rhs;
      if (condition.state === RuleState.LessThan) return lhs < rhs;
      if (condition.state === RuleState.GreaterOrEqual) return lhs >= rhs;
      return lhs <= rhs;
    }
    default:
      return false;
  }
};

/**
 * Check child conditions using field map for optimization
 */
const checkChildConditionsFast = (
  fieldMap: Map<string, Field>, 
  fields: Field[], 
  condition: RuleDomain
): boolean => {
  const prefix = condition.name + '.';
  const childFields = fields.filter((f) => f.name.startsWith(prefix));
  return childFields.every((childField) => checkCondition(childField, condition, fieldMap));
};

/**
 * Apply a target action to a field
 */
export const applyTarget = (field: Field, target: RuleDomain): void => {
  const shouldApply = !target.not;
  switch (target.state) {
    case RuleState.Set:
      field.checked = shouldApply;
      break;
    case RuleState.SetToValue:
      if (shouldApply) {
        field.value = target.value!;
        field.checked = true;
      } else {
        field.value = '';
        field.checked = false;
      }
      break;
    case RuleState.Contains:
      // Membership: ensure the value is present as a discrete item (array element, or an
      // exact string value). No substring join.
      if (shouldApply && target.value !== undefined) {
        if (Array.isArray(field.value)) {
          const arr = field.value as (string | number)[];
          if (!arr.includes(target.value)) field.value = [...arr, target.value] as string[];
        } else if (typeof field.value === 'string') {
          try {
            const parsed: unknown = JSON.parse(field.value);
            if (Array.isArray(parsed)) {
              const arr = parsed as (string | number)[];
              if (!arr.includes(target.value)) field.value = JSON.stringify([...arr, target.value]);
            } else {
              field.value = target.value;
            }
          } catch {
            field.value = target.value;
          }
        } else {
          field.value = target.value;
        }
        field.checked = true;
      } else if (!shouldApply && target.value !== undefined) {
        // "not contains" - remove the item from the field
        if (Array.isArray(field.value)) {
          field.value = (field.value as (string | number)[]).filter(v => String(v) !== target.value) as string[];
        } else if (typeof field.value === 'string') {
          try {
            const parsed: unknown = JSON.parse(field.value);
            if (Array.isArray(parsed)) {
              field.value = JSON.stringify((parsed as (string | number)[]).filter(v => String(v) !== target.value));
            } else if (field.value === target.value) {
              field.value = '';
            }
          } catch {
            if (field.value === target.value) field.value = '';
          }
        }
        if (field.value === '' || field.value === '[]') {
          field.checked = false;
        }
      }
      break;
    default:
      break;
  }
};

/**
 * Check if a field is unconditionally required by any rule
 */
export const isFieldRequired = (fieldName: string, rules: Rule[]): boolean => {
  return rules.some((rule) =>
    rule.targets.some((target) =>
      target.name === fieldName &&
      (target.state === RuleState.Set || target.state === RuleState.SetToValue || target.state === RuleState.Contains) &&
      (!rule.conditions || rule.conditions.length === 0)
    )
  );
};
