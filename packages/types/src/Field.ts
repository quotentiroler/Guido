/**
 * Field Types - Re-exported from Zod schemas (source of truth).
 * This file keeps parseRange() utility and FieldRange type alias.
 * 
 * @see schemas.ts for the canonical Zod schema definitions.
 */

// ============================================================================
// Types from Zod Schemas (source of truth)
// ============================================================================

export type {
  Field,
  FieldValue,
  FieldUpdate,
  NestedField,
  DataType,
  RangeType,
  ScalarRange,
  ArrayRange,
  EnumRange,
  EnumArrayRange,
  PatternRange,
  ParsedRange,
} from './schemas.js';

import type { DataType, ParsedRange } from './schemas.js';

// ============================================================================
// FieldRange - DSL string type (simple alias, not in Zod)
// ============================================================================

/**
 * Range types for field validation using a DSL string.
 * 
 * @description
 * ## Basic Types
 * - `"string"` - Any string value
 * - `"boolean"` - Must be "true" or "false"
 * - `"integer"` - Must be a whole number
 * - `"url"` - Must be a valid URL
 * 
 * ## Bounded Types
 * - `"integer(min..max)"` - Integer within value range
 * - `"string(min..max)"` - String with length constraints
 * 
 * ## Array Types
 * - `"string[]"` / `"integer[]"` - Array of values
 * - `"string[min..max]"` - Array with size constraints
 * 
 * ## Enum Options
 * - `"opt1||opt2||opt3"` - Must match one option
 * 
 * ## Custom Patterns
 * - A regex pattern (e.g., `"^[A-Z]{3}$"`)
 */
export type FieldRange = string;

/**
 * Parse a FieldRange DSL string into a structured ParsedRange object.
 * 
 * @param range - The DSL string to parse
 * @returns A typed ParsedRange object
 * 
 * @example
 * parseRange('string')           // { rangeType: 'scalar', dataType: 'string' }
 * parseRange('integer(1..100)')  // { rangeType: 'scalar', dataType: 'integer', min: 1, max: 100 }
 * parseRange('string[]')         // { rangeType: 'array', itemType: 'string' }
 * parseRange('a||b||c')          // { rangeType: 'enum', options: ['a', 'b', 'c'] }
 * parseRange('^\\d+$')           // { rangeType: 'pattern', regex: '^\\d+$' }
 */
export function parseRange(range: FieldRange): ParsedRange {
  // Handle basic types: "string", "boolean", "integer", "url"
  if (range === 'string' || range === 'boolean' || range === 'integer' || range === 'url') {
    return { rangeType: 'scalar', dataType: range };
  }

  // Handle bounded scalars: "integer(min..max)" or "string(min..max)"
  const boundedMatch = range.match(/^(string|integer|number)\((\d*)\.\.(\d*)\)$/);
  if (boundedMatch) {
    const baseType = boundedMatch[1] === 'number' ? 'integer' : boundedMatch[1] as DataType;
    return {
      rangeType: 'scalar',
      dataType: baseType,
      min: boundedMatch[2] ? Number(boundedMatch[2]) : undefined,
      max: boundedMatch[3] ? Number(boundedMatch[3]) : undefined,
    };
  }

  // Handle simple arrays: "string[]" or "integer[]"
  if (range === 'string[]' || range === 'integer[]') {
    return { rangeType: 'array', itemType: range === 'string[]' ? 'string' : 'integer' };
  }

  // Handle bounded arrays: "string[min..max]" or "integer[min..max]"
  const arrayMatch = range.match(/^(string|integer)\[(\d*)\.\.?(\d*)\]$/);
  if (arrayMatch) {
    return {
      rangeType: 'array',
      itemType: arrayMatch[1] as 'string' | 'integer',
      minSize: arrayMatch[2] ? Number(arrayMatch[2]) : undefined,
      maxSize: arrayMatch[3] ? Number(arrayMatch[3]) : undefined,
    };
  }

  // Handle enum arrays: "(opt1||opt2||opt3)[]" or "(opt1||opt2||opt3)[min..max]"
  const enumArrayMatch = range.match(/^\(([^)]+)\)\[(\d*)\.\.?(\d*)\]$/);
  if (enumArrayMatch) {
    const optionsStr = enumArrayMatch[1];
    const options = optionsStr.includes('||') 
      ? optionsStr.split('||') 
      : optionsStr.split(' / ').map(o => o.trim());
    return {
      rangeType: 'enum-array',
      options,
      minSize: enumArrayMatch[2] ? Number(enumArrayMatch[2]) : undefined,
      maxSize: enumArrayMatch[3] ? Number(enumArrayMatch[3]) : undefined,
    };
  }

  // Handle enum options: "opt1||opt2||opt3"
  if (range.includes('||')) {
    return { rangeType: 'enum', options: range.split('||') };
  }

  // Handle legacy enum syntax: "opt1 / opt2 / opt3"
  if (range.includes(' / ')) {
    return { rangeType: 'enum', options: range.split(' / ').map(o => o.trim()) };
  }

  // Everything else is treated as a regex pattern
  return { rangeType: 'pattern', regex: range };
}

// Field, FieldValue, FieldUpdate, NestedField are exported from schemas.ts above
