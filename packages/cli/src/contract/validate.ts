import { listRuleSetTags, selectRuleSets, validateSettings, type SettingsValidationIssue } from '@quotentiroler/guido-core';
import type { ContractTarget, RuleSet, Template } from '@quotentiroler/guido-types';
import { describeSource, readSource } from './sources/index.js';
import type { SourceContext } from './settings.js';
import type { ContractProblem } from './report.js';

export interface TargetRun {
  target: string;
  source: string;
  ruleset: string | null;
  keys: number;
  deployTime: number;
  errors: SettingsValidationIssue[];
  warnings: SettingsValidationIssue[];
  passed: boolean;
}

const targetRuleSets = (template: Template, target: ContractTarget): (RuleSet | null)[] => {
  if (target.tag) {
    const tagged = selectRuleSets(template, { tag: target.tag });
    if (tagged.length === 0) {
      throw new Error(`no ruleset has tag "${target.tag}". Available tags: ${listRuleSetTags(template).join(', ') || '(none)'}`);
    }
    return tagged;
  }
  if (target.ruleset) {
    const named = selectRuleSets(template, { rulesetName: target.ruleset });
    if (named.length === 0) {
      throw new Error(`ruleset "${target.ruleset}" not found. Available: ${template.ruleSets.map((rs) => rs.name).join(', ')}`);
    }
    return named.slice(0, 1);
  }
  return [selectRuleSets(template, {}).at(0) ?? null];
};

export const describeIssue = (issue: SettingsValidationIssue): string => {
  const details = [issue.expected && `expected ${issue.expected}`, issue.actual !== undefined && `actual ${issue.actual}`].filter(Boolean);
  return `${issue.field}: ${issue.message}${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
};

export function runTarget(template: Template, target: ContractTarget, context: SourceContext): TargetRun[] {
  const settings = readSource(target.source, context);
  return targetRuleSets(template, target).map((ruleSet) => {
    const result = validateSettings(template, settings.values, ruleSet, { deployTimeKeys: settings.deployTime });
    const errors = result.issues.filter((issue) => issue.type !== 'warning');
    const warnings = result.issues.filter((issue) => issue.type === 'warning');
    return {
      target: target.name,
      source: describeSource(target.source),
      ruleset: ruleSet?.name ?? null,
      keys: result.summary.totalFields,
      deployTime: settings.deployTime.size,
      errors,
      warnings,
      passed: result.isValid && !(target.strict && warnings.length > 0),
    };
  });
}

export const runProblems = (run: TargetRun, strict: boolean): ContractProblem[] => {
  const scope = `${run.target}${run.ruleset ? ` vs ${run.ruleset}` : ''}`;
  const failing = strict ? [...run.errors, ...run.warnings] : run.errors;
  return failing.map((issue) => ({ scope, message: describeIssue(issue) }));
};
