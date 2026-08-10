/**
 * @quotentiroler/guido-types - Shared TypeScript types for Guido configuration templates
 * 
 * All types are derived from Zod schemas (source of truth in schemas.ts).
 * This entry point exports only types via `export type` - NO Zod bundled.
 * 
 * For Zod schemas (runtime validation), import from '@quotentiroler/guido-types/schemas'.
 * 
 * @example
 * // Types only (no Zod bundled) - for frontend
 * import type { Field, Rule, Template } from '@quotentiroler/guido-types';
 * import { RuleState, parseRange, isTemplate } from '@quotentiroler/guido-types';
 * 
 * // Zod schemas for runtime validation - for MCP server
 * import { FieldSchema, RuleSchema, TemplateSchema } from '@quotentiroler/guido-types/schemas';
 */

// ============================================================================
// Types from Zod Schemas (source of truth) - compile-time only, tree-shaken
// ============================================================================

export type {
  // Core types
  Field,
  FieldValue,
  FieldUpdate,
  Rule,
  RuleDomain,
  RuleSet,
  RuleUpdate,
  CardinalityConstraint,
  Template,
  NestedField,
  // Range types
  DataType,
  RangeType,
  ScalarRange,
  ArrayRange,
  EnumRange,
  EnumArrayRange,
  PatternRange,
  ParsedRange,
} from './schemas.js';

// FieldRange is a simple type alias for the DSL string
export type { FieldRange } from './Field.js';

export type { 
  // Registry types
  RegistryDefinition,
  RegistryItem,
  RegistrySearchResult,
  RegistryConfig,
  BuiltInRegistryType,
  EndpointConfig,
  ResponseMapping,
  SearchFilter,
  AuthType,
  AuthLocation,
  PaginationType,
  HttpMethod,
  RegistryAuth,
  PaginationConfig,
  ResponseItemMapping,
  TemplateDetection
} from './Registry.js';

export type { JSONSchema, SchemaConversionContext } from './JSONSchema.js';

// ============================================================================
// Runtime Values (no Zod dependency)
// ============================================================================

// RuleState enum - runtime value for comparisons
export { RuleState } from './Rule.js';

// parseRange function - runtime utility  
export { parseRange } from './Field.js';

// isTemplate type guard - runtime utility
export { isTemplate } from './Template.js';
