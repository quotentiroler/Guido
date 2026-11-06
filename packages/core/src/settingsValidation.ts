import { RuleState, type Template, type FieldValue, type RuleSet, type Field, type Rule, type RuleDomain } from '@quotentiroler/guido-types';
import { conditionHolds, ruleConditionsHold, targetRequiresValue } from './applyRules.js';
import { isFieldSet, isFieldValueEmpty, validateValue } from './fieldUtils.js';
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

export interface SettingsValidationOptions {
  /** Keys supplied at deploy time: present and non-empty, but their value is unknown, so value checks skip them. */
  deployTimeKeys?: Iterable<string>;
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

/** NaN equals nothing and is not empty: a deploy-time field counts as set but meets no value condition. */
const UNKNOWN_VALUE = Number.NaN;

const shownValue = (field: Field | undefined, value: FieldValue | undefined): string | undefined =>
  field?.secret ? undefined : String(value);

const constrainsValue = (target: RuleDomain): boolean =>
  VALUE_STATES.has(target.state) || (target.state === RuleState.Set && target.not === true);

/** The template fields a target names: the field itself, or every child of a parent name. */
function targetFieldNames(target: RuleDomain, fieldMap: Map<string, Field>): string[] {
  if (fieldMap.has(target.name)) return [target.name];
  const prefix = `${target.name}.`;
  return [...fieldMap.keys()].filter((name) => name.startsWith(prefix));
}

/** Value targets the settings do not satisfy; a field already reported missing, or supplied at deploy time, is skipped. */
function valueRuleViolations(
  rules: Rule[],
  fieldMap: Map<string, Field>,
  skip: ReadonlySet<string>
): SettingsValidationIssue[] {
  const issues: SettingsValidationIssue[] = [];
  for (const rule of rules) {
    for (const target of rule.targets) {
      if (!constrainsValue(target) || skip.has(target.name) || conditionHolds(target, fieldMap)) continue;
      const field = fieldMap.get(target.name);
      issues.push({
        field: target.name,
        type: 'invalid',
        message: `Violates rule "${rule.description ?? 'unnamed'}"`,
        expected: describeCondition(target),
        actual: isFieldSet(field) ? shownValue(field, field?.value) : '(not set)',
      });
    }
  }
  return issues;
}

/**
 * Judge settings as given: a key holding an empty value is unset, rules fire on the given values only,
 * and nothing is filled in. Required: `checked` in the template, or the positive target of a rule that holds.
 */
export function validateSettings(
  template: Template,
  settings: Record<string, FieldValue>,
  ruleSet: RuleSet | null,
  options: SettingsValidationOptions = {}
): SettingsValidationResult {
  const issues: SettingsValidationIssue[] = [];
  const rules = ruleSet ? resolveRuleSetRules(template, ruleSet.name) : [];
  const constraints = ruleSet
    ? getRuleSetInheritanceChain(template, ruleSet.name).flatMap(
        (name) => template.ruleSets.find((rs) => rs.name === name)?.constraints ?? []
      )
    : [];
  const deployTime = new Set(options.deployTimeKeys ?? []);
  const settingsKeys = new Set([...Object.keys(settings), ...deployTime]);

  const fields: Field[] = template.fields.map((field) => {
    if (deployTime.has(field.name)) return { ...field, value: UNKNOWN_VALUE, checked: true };
    return settingsKeys.has(field.name)
      ? { ...field, value: settings[field.name], checked: !isFieldValueEmpty(settings[field.name]) }
      : { ...field, checked: false };
  });
  const fieldMap = new Map(fields.map((f) => [f.name, f]));
  const activeRules = rules.filter((rule) => ruleConditionsHold(rule, fieldMap));
  const required = new Set([
    ...template.fields.filter((f) => f.checked === true).map((f) => f.name),
    ...activeRules.flatMap((rule) =>
      rule.targets.filter(targetRequiresValue).flatMap((target) => targetFieldNames(target, fieldMap))
    ),
  ]);

  let validFields = 0;
  let missingRequired = 0;
  let invalidValues = 0;
  let warnings = 0;
  const missing = new Set<string>();

  for (const field of fields) {
    const hasValue = isFieldSet(field);

    if (required.has(field.name) && !hasValue) {
      issues.push({
        field: field.name,
        type: 'missing',
        message: `Required field is missing`,
        expected: field.range ? translateRangeToHumanReadable(field.range) : 'any value',
      });
      missing.add(field.name);
      missingRequired++;
      continue;
    }
    if (!hasValue) {
      if (settingsKeys.has(field.name)) validFields++;
      continue;
    }
    if (deployTime.has(field.name)) {
      validFields++;
      continue;
    }

    if (field.range && field.range !== 'string' && !validateValue(field.value, field.range)) {
      issues.push({
        field: field.name,
        type: 'invalid',
        message: `Value does not match expected range`,
        expected: translateRangeToHumanReadable(field.range),
        actual: shownValue(field, field.value),
      });
      invalidValues++;
      continue;
    }
    validFields++;
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

  for (const issue of valueRuleViolations(activeRules, fieldMap, new Set([...missing, ...deployTime]))) {
    issues.push(issue);
    invalidValues++;
  }

  const cardinality = validateCardinality(constraints, fields);
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
