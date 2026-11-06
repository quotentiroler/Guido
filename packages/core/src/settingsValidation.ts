import { RuleState, type Template, type FieldValue, type RuleSet, type Field, type Rule } from '@quotentiroler/guido-types';
import { applyRules, isFieldRequired, conditionHolds, ruleConditionsHold } from './applyRules.js';
import { validateValue } from './fieldUtils.js';
import { translateRangeToHumanReadable } from './rangeDescription.js';
import { validateCardinality } from './validateRules.js';
import { resolveRuleSetRules, getRuleSetInheritanceChain } from './rulesetUtils.js';
import { describeCondition } from './ruleTranslation.js';

export interface SettingsValidationIssue {
  field: string;
  type: 'missing' | 'invalid' | 'warning';
  message: string;
  expected?: string;
  actual?: string;
}

export interface SettingsValidationResult {
  isValid: boolean;
  issues: SettingsValidationIssue[];
  summary: {
    totalFields: number;
    validFields: number;
    missingRequired: number;
    invalidValues: number;
    warnings: number;
  };
}

/** Targets that constrain a value; a plain `set` target is a requirement, checked as such. */
const VALUE_STATES: ReadonlySet<string> = new Set([RuleState.SetToValue, RuleState.Contains]);

/** Value targets of rules whose conditions the settings meet, which the settings do not satisfy. */
function valueRuleViolations(rules: Rule[], fields: Field[]): SettingsValidationIssue[] {
  const fieldMap = new Map(fields.map((f) => [f.name, f]));
  const issues: SettingsValidationIssue[] = [];
  for (const rule of rules) {
    if (!ruleConditionsHold(rule, fieldMap)) continue;
    for (const target of rule.targets) {
      const constrainsValue = VALUE_STATES.has(target.state) || (target.state === RuleState.Set && target.not === true);
      if (!constrainsValue || conditionHolds(target, fieldMap)) continue;
      const field = fieldMap.get(target.name);
      issues.push({
        field: target.name,
        type: 'invalid',
        message: `Violates rule "${rule.description ?? 'unnamed'}"`,
        expected: describeCondition(target),
        actual: field?.checked ? String(field.value) : '(not set)',
      });
    }
  }
  return issues;
}

/** Required: `checked` in the template, targeted unconditionally, or enabled by a rule the settings trigger. */
export function validateSettings(
  template: Template,
  settings: Record<string, FieldValue>,
  ruleSet: RuleSet | null
): SettingsValidationResult {
  const issues: SettingsValidationIssue[] = [];
  const rules = ruleSet ? resolveRuleSetRules(template, ruleSet.name) : [];
  const constraints = ruleSet
    ? getRuleSetInheritanceChain(template, ruleSet.name).flatMap(
        (name) => template.ruleSets.find((rs) => rs.name === name)?.constraints ?? []
      )
    : [];
  const settingsKeys = new Set(Object.keys(settings));
  const requiredInTemplate = new Set(template.fields.filter((f) => f.checked === true).map((f) => f.name));

  const fields: Field[] = template.fields.map((field) =>
    settingsKeys.has(field.name)
      ? { ...field, value: settings[field.name], checked: true }
      : { ...field, checked: false }
  );
  const valueIssues = valueRuleViolations(rules, fields);
  const { updatedFields } = applyRules(fields.map((f) => ({ ...f })), rules);

  let validFields = 0;
  let missingRequired = 0;
  let invalidValues = 0;
  let warnings = 0;

  for (const field of updatedFields) {
    const hasValue = settingsKeys.has(field.name);
    const enabledByRule = field.checked === true && !hasValue;
    const isRequired = requiredInTemplate.has(field.name) || isFieldRequired(field.name, rules) || enabledByRule;
    const value = settings[field.name];

    if (isRequired && !hasValue) {
      issues.push({
        field: field.name,
        type: 'missing',
        message: `Required field is missing`,
        expected: field.range ? translateRangeToHumanReadable(field.range) : 'any value',
      });
      missingRequired++;
      continue;
    }

    if (hasValue && field.range && field.range !== 'string') {
      if (!validateValue(value, field.range)) {
        issues.push({
          field: field.name,
          type: 'invalid',
          message: `Value does not match expected range`,
          expected: translateRangeToHumanReadable(field.range),
          actual: String(value),
        });
        invalidValues++;
        continue;
      }
    }

    if (hasValue) {
      validFields++;
    }
  }

  const templateFieldNames = new Set(template.fields.map((f) => f.name));
  for (const key of settingsKeys) {
    if (!templateFieldNames.has(key)) {
      const isChild = [...templateFieldNames].some((name) => key.startsWith(name + '.'));
      if (!isChild) {
        issues.push({ field: key, type: 'warning', message: `Field not defined in template` });
        warnings++;
      }
    }
  }

  for (const issue of valueIssues) {
    issues.push(issue);
    invalidValues++;
  }

  const cardinality = validateCardinality(constraints, updatedFields);
  for (const message of cardinality.errors) {
    issues.push({ field: '(constraint)', type: 'invalid', message });
    invalidValues++;
  }

  return {
    isValid: missingRequired === 0 && invalidValues === 0,
    issues,
    summary: {
      totalFields: settingsKeys.size,
      validFields,
      missingRequired,
      invalidValues,
      warnings,
    },
  };
}
