import type { FieldValue, Template } from '@quotentiroler/guido-types';
import { selectValidationRuleSets, type RuleSetSelection } from './rulesetUtils.js';
import { validateSettings, type SettingsValidationOptions, type SettingsValidationResult } from './settingsValidation.js';

export interface RuleSetSettingsValidation {
  ruleSet: string | null;
  result: SettingsValidationResult;
  /** The result is valid and, in strict mode, free of warnings. */
  passed: boolean;
}

export interface SettingsSelectionOptions extends SettingsValidationOptions {
  strict?: boolean;
}

/** Validate settings against each selected ruleset (or none when the template has none), one result per ruleset. */
export function validateSettingsSelection(
  template: Template,
  settings: Record<string, FieldValue>,
  selection: RuleSetSelection,
  options: SettingsSelectionOptions = {}
): RuleSetSettingsValidation[] {
  const ruleSets = selectValidationRuleSets(template, selection);
  const targets = ruleSets.length > 0 ? ruleSets : [null];
  return targets.map((ruleSet) => {
    const result = validateSettings(template, settings, ruleSet, { deployTimeKeys: options.deployTimeKeys });
    return {
      ruleSet: ruleSet?.name ?? null,
      result,
      passed: result.isValid && (!options.strict || result.summary.warnings === 0),
    };
  });
}
