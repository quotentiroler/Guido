/**
 * Rule Types - Re-exported from Zod schemas (source of truth).
 * This file keeps the RuleState enum for runtime comparisons.
 * 
 * @see schemas.ts for the canonical Zod schema definitions.
 */

// ============================================================================
// Types from Zod Schemas (source of truth)
// ============================================================================

export type {
  Rule,
  RuleDomain,
  RuleSet,
  RuleUpdate,
} from './schemas.js';

// ============================================================================
// RuleState Enum - Kept here for runtime comparisons
// ============================================================================

/**
 * Represents the state of a rule condition or target.
 * 
 * - `Set`: Field must have a value (be set)
 * - `SetToValue`: Field must be set to a specific value  
 * - `Contains`: Field value must contain the specified substring
 * 
 * @enum {string}
 */
export enum RuleState {
  Set = "set",
  SetToValue = "set_to_value",
  Contains = "contains",
}
