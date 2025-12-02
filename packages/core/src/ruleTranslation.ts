/**
 * @guido/core - Rule Translation Utilities
 * 
 * Pure functions for translating between Guido rules and human-readable text.
 */

import { Rule, RuleState, RuleDomain } from '@guido/types';

/**
 * Translate a Guido Rule to human-readable text.
 * 
 * @param rule - The rule to translate
 * @param specificTarget - Optional: only translate this specific target field
 * @returns Human-readable description of the rule
 */
export const translateRule = (rule: Rule, specificTarget?: string): string => {
  const targets = specificTarget
    ? rule.targets.filter((target) => target.name === specificTarget)
    : rule.targets;
  const conditions = rule.conditions || [];

  const targetTexts = targets.map((target) => {
    const targetField = target.name;
    const targetState = target.state;
    const targetValue = target.value ?? "";
    const notText = target.not ? "not " : "";

    let stateText = "";
    if (targetState === RuleState.Set) {
      stateText = `'${targetField}' is required to be ${notText}set`;
    } else if (targetState === RuleState.SetToValue) {
      stateText = `'${targetField}' is required to be ${notText}set to the value '${targetValue}'`;
    } else if (targetState === RuleState.Contains) {
      stateText = `'${targetField}' must ${notText}contain '${targetValue}'`;
    } else {
      stateText = "Unknown target state";
    }

    return stateText;
  });

  const conditionTexts = conditions.map((condition) => {
    const conditionField = condition.name;
    const conditionState = condition.state;
    const conditionValue = condition.value ?? "";
    const notText = condition.not ? "not " : "";

    let stateText = "";
    if (conditionState === RuleState.Set) {
      stateText = `'${conditionField}' is ${notText}set`;
    } else if (conditionState === RuleState.SetToValue) {
      stateText = `'${conditionField}' is ${notText}set to the value '${conditionValue}'`;
    } else if (conditionState === RuleState.Contains) {
      stateText = `'${conditionField}' ${notText}contains '${conditionValue}'`;
    } else {
      stateText = "Unknown condition state";
    }

    return stateText;
  });

  if (conditionTexts.length === 0) {
    return targetTexts.join(" and ") + ".";
  }

  return `If ${conditionTexts.join(" and ")}, then ${targetTexts.join(
    " and "
  )}.`;
};

/**
 * Parse a natural language rule description into a Guido Rule object.
 * 
 * Supported patterns:
 * - "If X is set, then Y is required" / "If X is set then Y is set"
 * - "If X = value, then Y = value" / "If X is set to value then Y is set to value"
 * - "If X contains value, then Y contains value"
 * - "When X is enabled, enable Y" / "When X is disabled, disable Y"
 * - "X requires Y" / "Y depends on X"
 * - "If X is not set, then Y is not set" (negation)
 * - "Always set X" / "X is always required" (unconditional)
 * 
 * @param input - Natural language description of a rule
 * @param fieldNames - Optional list of valid field names for validation/matching
 * @returns Parsed Rule object or null if parsing fails
 */
export const parseNaturalLanguageRule = (
  input: string,
  fieldNames?: string[]
): Rule | null => {
  const trimmedInput = input.trim();
  
  // Helper to find the best matching field name (preserves case from fieldNames or original input)
  const matchFieldName = (text: string): string => {
    const cleaned = text.trim().replace(/^['"`]|['"`]$/g, '');
    if (!fieldNames || fieldNames.length === 0) {
      return cleaned;
    }
    // Exact match (case-insensitive) - return the field name with proper case
    const exactMatch = fieldNames.find(f => f.toLowerCase() === cleaned.toLowerCase());
    if (exactMatch) return exactMatch;
    
    // Partial match (field name contains the text or vice versa)
    const partialMatch = fieldNames.find(f => 
      f.toLowerCase().includes(cleaned.toLowerCase()) || 
      cleaned.toLowerCase().includes(f.toLowerCase())
    );
    if (partialMatch) return partialMatch;
    
    return cleaned;
  };

  // Helper to parse a single domain (condition or target)
  const parseDomain = (text: string): RuleDomain | null => {
    const trimmed = text.trim();
    
    // Check for negation
    const notPatterns = [
      /^not\s+/i,
      /\s+is\s+not\s+/i,
      /\s+not\s+/i,
      /^disable[ds]?\s+/i,
      /\s+disabled$/i,
      /^uncheck(?:ed)?\s+/i,
      /\s+unchecked$/i,
    ];
    let isNegated = false;
    let workingText = trimmed;
    
    for (const pattern of notPatterns) {
      if (pattern.test(workingText)) {
        isNegated = true;
        workingText = workingText.replace(pattern, ' ').trim();
        break;
      }
    }

    // Pattern: "'field' is required to be set to the value 'X'" (translateRule output)
    const translatorSetToValuePattern = /^['"`]?(.+?)['"`]?\s+is\s+required\s+to\s+be\s+(?:not\s+)?set\s+to\s+the\s+value\s+['"`](.+?)['"`]$/i;
    const translatorSetToValueMatch = workingText.match(translatorSetToValuePattern);
    if (translatorSetToValueMatch) {
      return {
        name: matchFieldName(translatorSetToValueMatch[1]),
        state: RuleState.SetToValue,
        value: translatorSetToValueMatch[2].trim(),
        not: isNegated || /not\s+set/.test(workingText.toLowerCase()),
      };
    }

    // Pattern: "'field' is required to be set" (translateRule output for Set)
    const translatorSetPattern = /^['"`]?(.+?)['"`]?\s+is\s+required\s+to\s+be\s+(not\s+)?set$/i;
    const translatorSetMatch = workingText.match(translatorSetPattern);
    if (translatorSetMatch) {
      return {
        name: matchFieldName(translatorSetMatch[1]),
        state: RuleState.Set,
        not: isNegated || !!translatorSetMatch[2],
      };
    }

    // Pattern: "'field' must contain 'value'" (translateRule output for Contains)
    const translatorContainsPattern = /^['"`]?(.+?)['"`]?\s+must\s+(not\s+)?contain\s+['"`](.+?)['"`]$/i;
    const translatorContainsMatch = workingText.match(translatorContainsPattern);
    if (translatorContainsMatch) {
      return {
        name: matchFieldName(translatorContainsMatch[1]),
        state: RuleState.Contains,
        value: translatorContainsMatch[3].trim(),
        not: isNegated || !!translatorContainsMatch[2],
      };
    }

    // Pattern: "'field' is set to the value 'X'" (translateRule condition output)
    const translatorCondSetToValuePattern = /^['"`]?(.+?)['"`]?\s+is\s+(?:not\s+)?set\s+to\s+the\s+value\s+['"`](.+?)['"`]$/i;
    const translatorCondSetToValueMatch = workingText.match(translatorCondSetToValuePattern);
    if (translatorCondSetToValueMatch) {
      return {
        name: matchFieldName(translatorCondSetToValueMatch[1]),
        state: RuleState.SetToValue,
        value: translatorCondSetToValueMatch[2].trim(),
        not: isNegated || /not\s+set/.test(workingText.toLowerCase()),
      };
    }

    // Pattern: "field = value" or "field is set to value" or "field equals value"
    const setToValuePatterns = [
      /^['"`]?(.+?)['"`]?\s*(?:=|equals?)\s*['"`]?(.+?)['"`]?$/i,
      /^['"`]?(.+?)['"`]?\s+is\s+(?:set\s+)?to\s+['"`]?(.+?)['"`]?$/i,
    ];
    for (const pattern of setToValuePatterns) {
      const match = workingText.match(pattern);
      if (match) {
        return {
          name: matchFieldName(match[1]),
          state: RuleState.SetToValue,
          value: match[2].trim().replace(/^['"`]|['"`]$/g, ''),
          not: isNegated,
        };
      }
    }

    // Pattern: "field contains value"
    const containsPatterns = [
      /^['"`]?(.+?)['"`]?\s+contains?\s+['"`]?(.+?)['"`]?$/i,
      /^['"`]?(.+?)['"`]?\s+includes?\s+['"`]?(.+?)['"`]?$/i,
    ];
    for (const pattern of containsPatterns) {
      const match = workingText.match(pattern);
      if (match) {
        return {
          name: matchFieldName(match[1]),
          state: RuleState.Contains,
          value: match[2].trim().replace(/^['"`]|['"`]$/g, ''),
          not: isNegated,
        };
      }
    }

    // Pattern: "field is set" or "field is enabled" or "field is checked" or just "field"
    const setPatterns = [
      /^['"`]?(.+?)['"`]?\s+is\s+(?:set|enabled|checked|required|active)$/i,
      /^(?:set|enable|check|require|activate)\s+['"`]?(.+?)['"`]?$/i,
      /^['"`]?(.+?)['"`]?\s+(?:enabled|checked|set)$/i,
      /^['"`]?(.+?)['"`]?$/i, // Fallback: just the field name
    ];
    for (const pattern of setPatterns) {
      const match = workingText.match(pattern);
      if (match) {
        const fieldName = match[1]?.trim();
        if (fieldName && fieldName.length > 0) {
          return {
            name: matchFieldName(fieldName),
            state: RuleState.Set,
            not: isNegated,
          };
        }
      }
    }

    return null;
  };

  // Pattern 1: "If ... then ..." or "When ... then ..." (case-insensitive match, but preserve original text)
  const ifThenPattern = /^(?:if|when)\s+(.+?)\s*,?\s*(?:then|,)\s+(.+?)\.?$/i;
  const ifThenMatch = trimmedInput.match(ifThenPattern);
  if (ifThenMatch) {
    const conditionsPart = ifThenMatch[1];
    const targetsPart = ifThenMatch[2];
    
    // Split by "and" for multiple conditions/targets (case-insensitive)
    const conditionTexts = conditionsPart.split(/\s+and\s+/i);
    const targetTexts = targetsPart.split(/\s+and\s+/i);
    
    const conditions = conditionTexts.map(parseDomain).filter((c): c is NonNullable<typeof c> => c !== null);
    const targets = targetTexts.map(parseDomain).filter((t): t is NonNullable<typeof t> => t !== null);
    
    if (targets.length > 0) {
      return {
        conditions: conditions.length > 0 ? conditions : undefined,
        targets,
      };
    }
  }

  // Pattern 2: "X requires Y" or "X needs Y"
  const requiresPattern = /^['"`]?(.+?)['"`]?\s+(?:requires?|needs?)\s+['"`]?(.+?)['"`]?\.?$/i;
  const requiresMatch = trimmedInput.match(requiresPattern);
  if (requiresMatch) {
    const condition = parseDomain(requiresMatch[1]);
    const target = parseDomain(requiresMatch[2]);
    if (condition && target) {
      return {
        conditions: [condition],
        targets: [target],
      };
    }
  }

  // Pattern 3: "Y depends on X"
  const dependsPattern = /^['"`]?(.+?)['"`]?\s+depends?\s+on\s+['"`]?(.+?)['"`]?\.?$/i;
  const dependsMatch = trimmedInput.match(dependsPattern);
  if (dependsMatch) {
    const target = parseDomain(dependsMatch[1]);
    const condition = parseDomain(dependsMatch[2]);
    if (condition && target) {
      return {
        conditions: [condition],
        targets: [target],
      };
    }
  }

  // Pattern 4: "Always X" or "X is always required" (unconditional)
  const alwaysPatternLower = trimmedInput.toLowerCase();
  if (alwaysPatternLower.includes('always') || alwaysPatternLower.includes('required')) {
    const alwaysMatch = trimmedInput.match(/^(?:always\s+(?:set|enable|check|require)\s+)?['"`]?(.+?)['"`]?(?:\s+is\s+(?:always\s+)?(?:required|enabled|set))?\.?$/i);
    if (alwaysMatch) {
      const target = parseDomain(alwaysMatch[1]);
      if (target) {
        return {
          targets: [target],
          // No conditions = unconditional rule
        };
      }
    }
  }

  return null;
};

/**
 * Validate that a natural language rule can be parsed.
 */
export const canParseNaturalLanguageRule = (input: string, fieldNames?: string[]): boolean => {
  return parseNaturalLanguageRule(input, fieldNames) !== null;
};
