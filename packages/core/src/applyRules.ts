/**
 * @guido/core - Apply Rules
 * 
 * Core rule application logic for evaluating and applying rules to fields.
 */

import type { Field, Rule, RuleDomain } from '@guido/types';
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

  rules.forEach((rule) => {
    const conditionsMet =
      !rule.conditions ||
      rule.conditions.every((condition) => {
        const field = fieldMap.get(condition.name);
        const conditionMet = field ? checkCondition(field, condition) : checkChildConditionsFast(fieldMap, updatedFields, condition);
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

  // Log all field changes
  log.logFieldChanges(fieldChanges, trigger);

  return { updatedFields, disabledReasons };
};

/**
 * Check if a condition is met for a field
 */
export const checkCondition = (field: Field, condition: RuleDomain): boolean => {
  const isChecked = field.checked ?? false;
  switch (condition.state) {
    case RuleState.Set:
      return field.value !== '' && isChecked;
    case RuleState.SetToValue:
      return field.value === condition.value && isChecked;
    case RuleState.Contains:
      if (!condition.value) return false;
      // Check if field value (string or array) contains the condition value
      if (Array.isArray(field.value)) {
        // Use type assertion since we're comparing string values at runtime
        return (field.value as (string | number)[]).includes(condition.value) && isChecked;
      }
      if (typeof field.value === 'string') {
        // Try to parse as JSON array first
        try {
          const parsedValue: unknown = JSON.parse(field.value);
          if (Array.isArray(parsedValue)) {
            return (parsedValue as (string | number)[]).includes(condition.value) && isChecked;
          }
        } catch {
          // Not valid JSON, treat as string
        }
        return field.value.includes(condition.value) && isChecked;
      }
      return false;
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
  return childFields.every((childField) => checkCondition(childField, condition));
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
      // For contains targets, we ensure the field is checked and contains the value
      if (shouldApply && target.value) {
        // Handle array field values directly
        if (Array.isArray(field.value)) {
          const arrValue = field.value as (string | number)[];
          if (!arrValue.includes(target.value)) {
            field.value = [...arrValue, target.value] as string[];
          }
        } else if (typeof field.value === 'string') {
          // Try to parse as JSON array first
          try {
            const parsedValue: unknown = JSON.parse(field.value);
            if (Array.isArray(parsedValue)) {
              // Add value to array if not already present
              const typedArray = parsedValue as (string | number)[];
              if (!typedArray.includes(target.value)) {
                field.value = JSON.stringify([...typedArray, target.value]);
              }
            } else {
              // Not an array, treat as string
              if (!field.value.includes(target.value)) {
                field.value = field.value ? `${field.value} ${target.value}` : target.value;
              }
            }
          } catch {
            // Not valid JSON, treat as string
            if (!field.value.includes(target.value)) {
              field.value = field.value ? `${field.value} ${target.value}` : target.value;
            }
          }
        } else {
          // For number/boolean, convert to string with target value
          field.value = target.value;
        }
        field.checked = true;
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
