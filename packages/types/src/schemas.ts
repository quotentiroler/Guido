/**
 * Zod Schemas - Source of Truth for Guido Types
 * 
 * This file defines all Zod schemas that serve as the single source of truth
 * for type definitions across the Guido project. TypeScript types are derived
 * from these schemas using z.infer<>.
 * 
 * Benefits:
 * - Single source of truth for types and runtime validation
 * - Automatic TypeScript type inference
 * - Runtime validation for MCP tools, API boundaries, and file loading
 * - Consistent validation logic across packages
 */
import { z } from 'zod';

// Import the TypeScript enum from Rule.ts
import { RuleState } from './Rule.js';

// ============================================================================
// Rule State Schema (using TypeScript enum)
// ============================================================================

/**
 * RuleState schema - uses the TypeScript enum directly.
 * In Zod v4, z.enum() accepts TypeScript enums natively!
 * This ensures the inferred type matches the enum type.
 */
export const RuleStateSchema = z.enum(RuleState);

// Re-export the enum for convenience
export { RuleState };

// ============================================================================
// Field Value Schema
// ============================================================================

/**
 * FieldValue schema - the possible types for a field's value.
 * Can be a string, number, boolean, or array of strings/numbers.
 */
export const FieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number()),
]);

// ============================================================================
// Rule Domain Schema
// ============================================================================

/**
 * RuleDomain schema - represents a condition or target in a rule.
 * Used both for defining when a rule applies (conditions) and
 * what changes to make (targets).
 */
export const RuleDomainSchema = z.object({
  /** The name of the field this domain references */
  name: z.string(),
  
  /** The state to check or set */
  state: RuleStateSchema,
  
  /** The value to match or set (required when state is 'set_to_value' or 'contains') */
  value: z.string().optional(),
  
  /** Negates the condition (e.g., "field is NOT set") */
  not: z.boolean().optional(),
});

// ============================================================================
// Rule Schema
// ============================================================================

/**
 * Rule schema - defines a conditional configuration rule.
 * When conditions match, the targets are applied to fields.
 */
export const RuleSchema = z.object({
  /** Optional conditions that must be met for the rule to apply */
  conditions: z.array(RuleDomainSchema).optional(),
  
  /** The targets to apply when conditions are met */
  targets: z.array(RuleDomainSchema),
  
  /** Human-readable description of what the rule does */
  description: z.string().optional(),
});

/**
 * RuleUpdate schema - for partial rule updates via MCP tools.
 * All fields are optional since you might only update conditions, targets, or description.
 */
export const RuleUpdateSchema = z.object({
  conditions: z.array(RuleDomainSchema).optional(),
  targets: z.array(RuleDomainSchema).optional(),
  description: z.string().optional(),
});

// ============================================================================
// RuleSet Schema
// ============================================================================

/**
 * RuleSet schema - a named collection of rules with metadata.
 */
export const RuleSetSchema = z.object({
  /** Unique name for the ruleset */
  name: z.string(),
  
  /** Human-readable description */
  description: z.string(),
  
  /** Tags for categorization (e.g., ["security", "required"]) */
  tags: z.array(z.string()),
  
  /** The rules in this ruleset */
  rules: z.array(RuleSchema),
  
  /** Name of another ruleset to inherit rules from */
  extends: z.string().optional(),
});

// ============================================================================
// Field Schema
// ============================================================================

/**
 * Field schema - a configuration field with value, metadata, and validation info.
 */
export const FieldSchema = z.object({
  /** The dot-path name of the field (e.g., "Database.ConnectionString") */
  name: z.string(),
  
  /** The current value of the field */
  value: FieldValueSchema,
  
  /** Description/information about the field */
  info: z.string(),
  
  /** Example value for the field */
  example: z.string(),
  
  /** Range DSL string for validation (e.g., "string", "integer(1..100)", "a||b||c") */
  range: z.string(),
  
  /** Optional link to documentation */
  link: z.string().optional(),
  
  /** Whether the field is checked/selected */
  checked: z.boolean().optional(),
});

/**
 * FieldUpdate schema - for partial field updates via MCP tools.
 * Only name is required, other fields are optional for selective updates.
 */
export const FieldUpdateSchema = z.object({
  name: z.string(),
  value: FieldValueSchema.optional(),
  checked: z.boolean().optional(),
});

// ============================================================================
// Template Schema
// ============================================================================

/**
 * Template schema - the root schema for a Guido template file.
 */
export const TemplateSchema = z.object({
  /** Template name */
  name: z.string(),
  
  /** Output file name */
  fileName: z.string(),
  
  /** Template version */
  version: z.string(),
  
  /** Template description */
  description: z.string(),
  
  /** Owner organization or user */
  owner: z.string(),
  
  /** Target application name */
  application: z.string().optional(),
  
  /** Link to documentation */
  docs: z.string().optional(),
  
  /** Command to run with the template */
  command: z.string().optional(),
  
  /** Array of configuration fields */
  fields: z.array(FieldSchema),
  
  /** Named collections of rules */
  ruleSets: z.array(RuleSetSchema),
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

// Note: RuleState is imported from Rule.ts (TypeScript enum), not inferred from Zod

/** FieldValue type - inferred from schema */
export type FieldValue = z.infer<typeof FieldValueSchema>;

/** RuleDomain type - inferred from schema */
export type RuleDomain = z.infer<typeof RuleDomainSchema>;

/** Rule type - inferred from schema */
export type Rule = z.infer<typeof RuleSchema>;

/** RuleUpdate type - inferred from schema */
export type RuleUpdate = z.infer<typeof RuleUpdateSchema>;

/** RuleSet type - inferred from schema */
export type RuleSet = z.infer<typeof RuleSetSchema>;

/** Field type - inferred from schema */
export type Field = z.infer<typeof FieldSchema>;

/** FieldUpdate type - inferred from schema */
export type FieldUpdate = z.infer<typeof FieldUpdateSchema>;

/** Template type - inferred from schema */
export type Template = z.infer<typeof TemplateSchema>;

// ============================================================================
// Range Schemas - Parsed representation of field range DSL
// ============================================================================

/**
 * DataType schema - base data types supported by Guido.
 */
export const DataTypeSchema = z.enum(['string', 'boolean', 'integer', 'url']);

/**
 * RangeType schema - discriminator for parsed range types.
 */
export const RangeTypeSchema = z.enum(['scalar', 'array', 'enum', 'enum-array', 'pattern']);

/**
 * ScalarRange schema - a single value with optional bounds.
 * 
 * @example
 * "string"           -> { rangeType: 'scalar', dataType: 'string' }
 * "integer(1..100)"  -> { rangeType: 'scalar', dataType: 'integer', min: 1, max: 100 }
 */
export const ScalarRangeSchema = z.object({
  rangeType: z.literal('scalar'),
  dataType: DataTypeSchema,
  min: z.number().optional(),
  max: z.number().optional(),
});

/**
 * ArrayRange schema - an array of items with optional size constraints.
 * 
 * @example
 * "string[]"        -> { rangeType: 'array', itemType: 'string' }
 * "integer[1..10]"  -> { rangeType: 'array', itemType: 'integer', minSize: 1, maxSize: 10 }
 */
export const ArrayRangeSchema = z.object({
  rangeType: z.literal('array'),
  itemType: z.enum(['string', 'integer']),
  minSize: z.number().optional(),
  maxSize: z.number().optional(),
});

/**
 * EnumRange schema - a set of allowed values.
 * 
 * @example
 * "debug||info||warn||error" -> { rangeType: 'enum', options: ['debug', 'info', 'warn', 'error'] }
 */
export const EnumRangeSchema = z.object({
  rangeType: z.literal('enum'),
  options: z.array(z.string()),
});

/**
 * EnumArrayRange schema - an array where each item must be one of the allowed values.
 * 
 * @example
 * "(debug||info||warn||error)[]" -> { rangeType: 'enum-array', options: [...] }
 */
export const EnumArrayRangeSchema = z.object({
  rangeType: z.literal('enum-array'),
  options: z.array(z.string()),
  minSize: z.number().optional(),
  maxSize: z.number().optional(),
});

/**
 * PatternRange schema - a regex pattern for validation.
 * 
 * @example
 * "^[A-Z]{3}$" -> { rangeType: 'pattern', regex: '^[A-Z]{3}$' }
 */
export const PatternRangeSchema = z.object({
  rangeType: z.literal('pattern'),
  regex: z.string(),
});

/**
 * ParsedRange schema - union of all parsed range types.
 * This is what parseRange() returns after interpreting the DSL string.
 */
export const ParsedRangeSchema = z.discriminatedUnion('rangeType', [
  ScalarRangeSchema,
  ArrayRangeSchema,
  EnumRangeSchema,
  EnumArrayRangeSchema,
  PatternRangeSchema,
]);

// ============================================================================
// NestedField Schema - For template authoring
// ============================================================================

/**
 * NestedField schema - represents a field that can contain child fields.
 * Used for authoring templates with hierarchical structure.
 * Note: Uses z.lazy() for recursive type definition.
 */
export const NestedFieldSchema: z.ZodType<NestedField> = FieldSchema.extend({
  fields: z.lazy(() => z.array(NestedFieldSchema)).optional(),
  type: z.string().optional(),
  options: z.array(z.string()).optional(),
});

// ============================================================================
// Range Inferred Types
// ============================================================================

/** DataType type - base data types */
export type DataType = z.infer<typeof DataTypeSchema>;

/** RangeType type - discriminator for parsed ranges */
export type RangeType = z.infer<typeof RangeTypeSchema>;

/** ScalarRange type - single value with bounds */
export type ScalarRange = z.infer<typeof ScalarRangeSchema>;

/** ArrayRange type - array with size constraints */
export type ArrayRange = z.infer<typeof ArrayRangeSchema>;

/** EnumRange type - set of allowed values */
export type EnumRange = z.infer<typeof EnumRangeSchema>;

/** EnumArrayRange type - array of enum values */
export type EnumArrayRange = z.infer<typeof EnumArrayRangeSchema>;

/** PatternRange type - regex pattern */
export type PatternRange = z.infer<typeof PatternRangeSchema>;

/** ParsedRange type - union of all range types */
export type ParsedRange = z.infer<typeof ParsedRangeSchema>;

/** NestedField type - field with optional child fields */
export type NestedField = Field & {
  fields?: NestedField[];
  type?: string;
  options?: string[];
};
