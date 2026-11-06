import { validateSettingsSelection, type SettingsValidationIssue } from '@quotentiroler/guido-core';
import type { ContractTarget, Template } from '@quotentiroler/guido-types';
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

export const describeIssue = (issue: SettingsValidationIssue): string => {
  const details = [issue.expected && `expected ${issue.expected}`, issue.actual !== undefined && `actual ${issue.actual}`].filter(Boolean);
  return `${issue.field}: ${issue.message}${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
};

export function runTarget(template: Template, target: ContractTarget, context: SourceContext): TargetRun[] {
  const settings = readSource(target.source, context);
  const selection = { rulesetName: target.ruleset, tag: target.tag };
  const runs = validateSettingsSelection(template, settings.values, selection, {
    strict: target.strict,
    deployTimeKeys: settings.deployTime,
  });
  return runs.map(({ ruleSet, result, passed }) => {
    const errors = result.issues.filter((issue) => issue.type !== 'warning');
    const warnings = result.issues.filter((issue) => issue.type === 'warning');
    return {
      target: target.name,
      source: describeSource(target.source),
      ruleset: ruleSet,
      keys: result.summary.totalFields,
      deployTime: settings.deployTime.size,
      errors,
      warnings,
      passed,
    };
  });
}

export const runProblems = (run: TargetRun, strict: boolean): ContractProblem[] => {
  const scope = `${run.target}${run.ruleset ? ` vs ${run.ruleset}` : ''}`;
  const failing = strict ? [...run.errors, ...run.warnings] : run.errors;
  return failing.map((issue) => ({ scope, message: describeIssue(issue) }));
};
