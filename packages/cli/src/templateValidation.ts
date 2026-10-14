/**
 * Validates a Guido template's rulesets, for the validate-template CLI.
 */
import { validateRules, applyRules, resolveRuleSetRules } from '@quotentiroler/guido-core';
import { SilentLogger } from '@quotentiroler/guido-logger';
import type { Template, RuleSet, Field, Rule } from '@quotentiroler/guido-types';

export interface ComplianceIssue {
  field: string;
  property: 'checked' | 'value';
  expected: unknown;
  actual: unknown;
  reason: string;
}

export interface RuleSetValidation {
  ruleCount: number;
  errors: string[];
  suggestions: string[];
  compliance: { compliant: boolean; issues: ComplianceIssue[] };
}

export interface RuleSetSelection {
  rulesetName?: string;
  tag?: string;
}

/** Every ruleset, unless a name or tag narrows it: a template is valid only when all of them are. */
export function selectRuleSets(template: Template, selection: RuleSetSelection): RuleSet[] {
  const all = template.ruleSets || [];
  if (selection.rulesetName) {
    const name = selection.rulesetName.toLowerCase();
    return all.filter((rs) => rs.name.toLowerCase() === name);
  }
  if (selection.tag) {
    const tag = selection.tag.toLowerCase();
    return all.filter((rs) => rs.tags?.some((t) => t.toLowerCase() === tag));
  }
  return all;
}

/** Whether the template's default field states already satisfy the rules (nothing changes on load). */
export function checkFieldCompliance(fields: Field[], rules: Rule[]): RuleSetValidation['compliance'] {
  const issues: ComplianceIssue[] = [];
  const { updatedFields, disabledReasons } = applyRules(fields.map((f) => ({ ...f })), rules, { logger: new SilentLogger() });
  fields.forEach((original, i) => {
    const updated = updatedFields[i];
    const reason = disabledReasons[original.name] || 'Rule enforcement';
    if (original.checked !== updated.checked) {
      issues.push({ field: original.name, property: 'checked', expected: updated.checked, actual: original.checked, reason });
    }
    if (original.value !== updated.value) {
      issues.push({ field: original.name, property: 'value', expected: updated.value, actual: original.value, reason });
    }
  });
  return { compliant: issues.length === 0, issues };
}

/** A ruleset checked together with the rules it inherits through `extends`. */
export function validateTemplateRuleSet(template: Template, ruleSet: RuleSet): RuleSetValidation {
  const rules = resolveRuleSetRules(template, ruleSet.name);
  const result = rules.length > 0 ? validateRules(rules) : { isValid: true, errors: [] };
  return {
    ruleCount: rules.length,
    errors: result.errors.filter((e) => !e.includes('can be merged')),
    suggestions: result.errors.filter((e) => e.includes('can be merged')),
    compliance: checkFieldCompliance(template.fields, rules),
  };
}
