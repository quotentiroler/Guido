/**
 * @quotentiroler/guido-core - Core utilities for Guido template management
 */

// Rule validation
export { validateRules, validateRulesAgainstFields, findContradictions, validateCardinality } from './validateRules.js';
export type { ValidationResult, Contradiction } from './validateRules.js';

// RuleSet utilities (inheritance, resolution, validation)
export {
  resolveRuleSetRules,
  getDefaultRules,
  getRuleSetRules,
  getRuleSetInheritanceChain,
  validateRuleSetInheritance,
  findRuleSet,
  findRuleSetIndex,
  getChildRuleSets,
  hasChildRuleSets,
  selectRuleSets,
  requireRuleSets,
  selectValidationRuleSets,
  listRuleSetTags,
} from './rulesetUtils.js';
export type { InheritanceValidationResult, RuleSetSelection } from './rulesetUtils.js';

export { validateSettings } from './settingsValidation.js';
export type { SettingsValidationIssue, SettingsValidationResult } from './settingsValidation.js';
export { validateSettingsSelection } from './settingsSelection.js';
export type { RuleSetSettingsValidation, SettingsSelectionOptions } from './settingsSelection.js';

// Rule application
export { 
  applyRules, 
  checkCondition, 
  conditionHolds,
  ruleConditionsHold,
  applyTarget, 
  isFieldRequired 
} from './applyRules.js';
export type { ApplyRulesResult, ApplyRulesOptions } from './applyRules.js';

// Rule translation (human-readable <-> DSL)
export {
  translateRule,
  describeCondition,
  parseNaturalLanguageRule,
  canParseNaturalLanguageRule
} from './ruleTranslation.js';

// Explain (why is field X in its current state?)
export { explainField } from './explain.js';
export type { Explanation, ExplanationStep, ConditionTrace, ConditionSource, ExplanationOutcome } from './explain.js';

// Field utilities
export {
  validateValue,
  validateWithParsedRange,
  hasEmptyProperty,
  prioritizeIncompleteFields,
  generateParentPaths,
  hasNestedFields,
  flattenNestedFields,
  flattenObject,
  fieldsToNestedObject,
  toFieldValues,
  mergeSettingsIntoFields,
  updateFields,
  fieldValueToString,
  isFieldValueEmpty,
} from './fieldUtils.js';
export { translateRangeToHumanReadable } from './rangeDescription.js';

// Template utilities
export { normalizeTemplateFields, mergeTemplates, createDefaultRuleSet } from './templateUtils.js';

// Configuration formats (serialize/parse: json, yaml, ini, args, properties, env, txt)
export {
  CONFIG_FORMATS,
  serializeFields,
  parseSettings,
  detectFormat,
  formatMeta,
  serializeIni,
  parseIni,
  serializeArgs,
  parseArgs,
  serializeKeyValue,
  parseKeyValueFormat,
} from './formats/index.js';
export type {
  ConfigFormat,
  FormatMeta,
  ParseSettingsOptions,
  SerializeOptions,
  IniSerializeOptions,
  ArgsSerializeOptions,
  KeyValueSerializeOptions,
} from './formats/index.js';
