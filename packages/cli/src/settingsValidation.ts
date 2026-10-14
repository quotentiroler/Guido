/**
 * Validates a settings object against a Guido template, for the validate-settings CLI.
 */
import {
  applyRules,
  validateValue,
  validateCardinality,
  isFieldRequired,
  translateRangeToHumanReadable,
  resolveRuleSetRules,
  getRuleSetInheritanceChain,
} from '@quotentiroler/guido-core';
import type { Template, FieldValue, RuleSet, Field } from '@quotentiroler/guido-types';

export interface ValidationIssue {
  field: string;
  type: 'missing' | 'invalid' | 'warning';
  message: string;
  expected?: string;
  actual?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: {
    totalFields: number;
    validFields: number;
    missingRequired: number;
    invalidValues: number;
    warnings: number;
  };
}

/**
 * A field is required when the template marks it `checked`, an unconditional rule targets it,
 * or a rule whose conditions the settings meet enables it. A field the settings leave out is
 * otherwise optional: its default applies.
 */
export function validateSettings(
  template: Template,
  settings: Record<string, FieldValue>,
  ruleSet: RuleSet | null
): ValidationResult {
  const issues: ValidationIssue[] = [];
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
  const { updatedFields } = applyRules(fields, rules);

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
