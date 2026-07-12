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
 * - `Contains`: field contains `value` as a discrete item - an array element, or an
 *   exact string match. Not a substring match.
 * - `GreaterThan` / `LessThan` / `GreaterOrEqual` / `LessOrEqual`: numeric comparison
 *   of the field's value against `value` (condition-only)
 *
 * @enum {string}
 */
export enum RuleState {
  Set = "set",
  SetToValue = "set_to_value",
  Contains = "contains",
  GreaterThan = "gt",
  LessThan = "lt",
  GreaterOrEqual = "gte",
  LessOrEqual = "lte",
}
