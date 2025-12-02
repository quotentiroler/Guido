/**
 * Apply Rules - GUI wrapper
 * 
 * Re-exports applyRules from @guido/core with the GUI's logger injected.
 */

import type { Field, Rule } from "@guido/types";
import { applyRules as coreApplyRules, isFieldRequired } from '@guido/core';
import type { ApplyRulesResult } from '@guido/core';
import { logger } from "./logger";
import type { TriggerAction } from "./logger";

// Re-export types and isFieldRequired
export { isFieldRequired };
export type { ApplyRulesResult };

/**
 * Apply rules to fields and track all changes (with GUI logger)
 * 
 * @param fields - The current field states (after user action)
 * @param rules - Rules to apply
 * @param trigger - What triggered this rule application
 * @param originalFields - Original field states before user action (for tracking user changes)
 */
export const applyRules = (
  fields: Field[], 
  rules: Rule[] = [], 
  trigger?: TriggerAction,
  originalFields?: Field[]
): ApplyRulesResult => {
  return coreApplyRules(fields, rules, {
    logger,
    trigger,
    originalFields,
  });
};