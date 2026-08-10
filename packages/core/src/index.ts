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
} from './rulesetUtils.js';
export type { InheritanceValidationResult } from './rulesetUtils.js';

// Rule application
export { 
  applyRules, 
  checkCondition, 
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
  translateRangeToHumanReadable,
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
  SerializeOptions,
  IniSerializeOptions,
  ArgsSerializeOptions,
  KeyValueSerializeOptions,
} from './formats/index.js';
