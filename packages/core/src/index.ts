/**
 * @guido/core - Core utilities for Guido template management
 */

// Rule validation
export { validateRules } from './validateRules.js';
export type { ValidationResult } from './validateRules.js';

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
  parseNaturalLanguageRule, 
  canParseNaturalLanguageRule 
} from './ruleTranslation.js';

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
  parseKeyValueFormat,
  toFieldValues,
  mergeSettingsIntoFields,
  updateFields,
  fieldValueToString,
  isFieldValueEmpty,
} from './fieldUtils.js';

// Template utilities
export { normalizeTemplateFields, mergeTemplates, createDefaultRuleSet } from './templateUtils.js';
