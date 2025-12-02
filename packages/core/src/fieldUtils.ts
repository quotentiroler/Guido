/**
 * @guido/core - Field Utilities
 * 
 * Pure functions for field validation and manipulation.
 */

import { Field, FieldRange, FieldValue, NestedField, parseRange, ParsedRange } from '@guido/types';

/**
 * Translates a technical range specification to a user-friendly description.
 * 
 * @param range - The range specification (DSL string)
 * @returns A human-readable description of what values are accepted
 * 
 * @example
 * translateRangeToHumanReadable('string')           // 'Any text'
 * translateRangeToHumanReadable('boolean')          // 'Yes or No (true/false)'
 * translateRangeToHumanReadable('integer(1..100)')  // 'A whole number between 1 and 100'
 * translateRangeToHumanReadable('string[]')         // 'A list of text values'
 * translateRangeToHumanReadable('debug||info||warn')// 'One of: debug, info, warn'
 */
export const translateRangeToHumanReadable = (range: FieldRange): string => {
  if (!range || range.trim() === '') {
    return 'Any value';
  }

  const parsed = parseRange(range);
  return formatParsedRange(parsed, range);
};

/**
 * Format a parsed range into human-readable text.
 */
function formatParsedRange(parsed: ParsedRange, originalRange: string): string {
  switch (parsed.rangeType) {
    case 'scalar':
      return formatScalarRange(parsed);
    case 'array':
      return formatArrayRange(parsed);
    case 'enum':
      return formatEnumRange(parsed);
    case 'enum-array':
      return formatEnumArrayRange(parsed);
    case 'pattern':
      return formatPatternRange(parsed, originalRange);
  }
}

/**
 * Format scalar ranges (string, boolean, integer, url) with optional bounds.
 */
function formatScalarRange(range: { dataType: string; min?: number; max?: number }): string {
  const { dataType, min, max } = range;

  switch (dataType) {
    case 'string':
      if (min !== undefined && max !== undefined) {
        if (min === max) {
          return `Text with exactly ${min} character${min !== 1 ? 's' : ''}`;
        }
        return `Text between ${min} and ${max} characters`;
      }
      if (min !== undefined) {
        return `Text with at least ${min} character${min !== 1 ? 's' : ''}`;
      }
      if (max !== undefined) {
        return `Text with up to ${max} character${max !== 1 ? 's' : ''}`;
      }
      return 'Any text';

    case 'boolean':
      return 'Yes or No (true/false)';

    case 'url':
      return 'A valid web address (URL)';

    case 'integer':
      if (min !== undefined && max !== undefined) {
        return `A whole number between ${min} and ${max}`;
      }
      if (min !== undefined) {
        return `A whole number of ${min} or more`;
      }
      if (max !== undefined) {
        return `A whole number up to ${max}`;
      }
      return 'A whole number';

    default:
      return 'Any value';
  }
}

/**
 * Format array ranges with optional size constraints.
 */
function formatArrayRange(range: { itemType: 'string' | 'integer'; minSize?: number; maxSize?: number }): string {
  const { itemType, minSize, maxSize } = range;
  const itemDescription = itemType === 'string' ? 'text values' : 'whole numbers';

  if (minSize !== undefined && maxSize !== undefined) {
    if (minSize === maxSize) {
      return `A list of exactly ${minSize} ${itemDescription}`;
    }
    return `A list of ${minSize} to ${maxSize} ${itemDescription}`;
  }
  if (minSize !== undefined) {
    return `A list of at least ${minSize} ${itemDescription}`;
  }
  if (maxSize !== undefined) {
    return `A list of up to ${maxSize} ${itemDescription}`;
  }
  return `A list of ${itemDescription}`;
}

/**
 * Format enum ranges (list of allowed options).
 */
function formatEnumRange(range: { options: string[] }): string {
  const { options } = range;
  
  if (options.length === 0) {
    return 'Any value';
  }
  if (options.length === 1) {
    return `Must be: ${options[0]}`;
  }
  if (options.length === 2) {
    return `Either "${options[0]}" or "${options[1]}"`;
  }
  if (options.length <= 5) {
    return `One of: ${options.join(', ')}`;
  }
  // For many options, show first few and count
  const shown = options.slice(0, 3).join(', ');
  return `One of: ${shown}, ... (${options.length} options)`;
}

/**
 * Format enum array ranges (list of multiple allowed options).
 */
function formatEnumArrayRange(range: { options: string[]; minSize?: number; maxSize?: number }): string {
  const { options, minSize, maxSize } = range;
  
  let optionsDesc: string;
  if (options.length === 0) {
    optionsDesc = 'any values';
  } else if (options.length <= 5) {
    optionsDesc = options.join(', ');
  } else {
    const shown = options.slice(0, 3).join(', ');
    optionsDesc = `${shown}, ... (${options.length} options)`;
  }
  
  let sizeConstraint = '';
  if (minSize !== undefined && maxSize !== undefined) {
    if (minSize === maxSize) {
      sizeConstraint = ` (exactly ${minSize})`;
    } else {
      sizeConstraint = ` (${minSize} to ${maxSize} items)`;
    }
  } else if (minSize !== undefined) {
    sizeConstraint = ` (at least ${minSize})`;
  } else if (maxSize !== undefined) {
    sizeConstraint = ` (up to ${maxSize})`;
  }
  
  return `Multiple of: ${optionsDesc}${sizeConstraint}`;
}

/**
 * Format pattern/regex ranges with user-friendly explanations for common patterns.
 */
function formatPatternRange(range: { regex: string }, originalRange: string): string {
  const { regex } = range;
  
  // Common pattern translations
  const commonPatterns: Array<{ pattern: RegExp; description: string | ((match: RegExpMatchArray) => string) }> = [
    // Email pattern
    { pattern: /^\^?\[.*@.*\]\*?\$?$|email/i, description: 'A valid email address' },
    // UUID/GUID pattern
    { pattern: /[0-9a-f]{8}.*[0-9a-f]{4}.*[0-9a-f]{4}/i, description: 'A unique identifier (UUID/GUID)' },
    // IP address pattern
    { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[0-9\].*\[0-9\].*\[0-9\].*\[0-9\]/i, description: 'An IP address' },
    // Date patterns
    { pattern: /\d{4}.*\d{2}.*\d{2}|yyyy|mm|dd/i, description: 'A date' },
    // Alphanumeric only
    { pattern: /^\^?\[a-z0-9\]/i, description: 'Letters and numbers only' },
    // Letters only
    { pattern: /^\^?\[a-z\]/i, description: 'Letters only' },
    // Numbers only (not integer type)
    { pattern: /^\^?\[0-9\]|\^?\\d/i, description: 'Numbers only' },
    // Hex color
    { pattern: /#?[0-9a-f]{6}|#?[0-9a-f]{3}/i, description: 'A color code (e.g., #FF5733)' },
    // File path
    { pattern: /path|file|directory|folder/i, description: 'A file or folder path' },
    // Version number
    { pattern: /\d+\.\d+\.\d+|version|semver/i, description: 'A version number (e.g., 1.0.0)' },
  ];

  // Check for common patterns
  for (const { pattern, description } of commonPatterns) {
    if (pattern.test(regex) || pattern.test(originalRange)) {
      return typeof description === 'function' 
        ? description(originalRange.match(pattern)!) 
        : description;
    }
  }

  // For unknown patterns, provide a generic but helpful message
  // Check if it's a simple character class restriction
  const simpleCharClass = regex.match(/^\^?\[([^\]]+)\][+*]?\$?$/);
  if (simpleCharClass) {
    return `Text containing only: ${simpleCharClass[1]}`;
  }

  // Check for length restrictions in regex
  const lengthMatch = regex.match(/\{(\d+),?(\d*)?\}/);
  if (lengthMatch) {
    const min = lengthMatch[1];
    const max = lengthMatch[2];
    if (max) {
      return `Text matching a specific format (${min}-${max} characters)`;
    }
    return `Text matching a specific format (${min}+ characters)`;
  }

  return 'Text matching a specific format';
}

/**
 * Validate a field value against its range specification.
 * 
 * @param value - The value to validate
 * @param range - The range specification (DSL string)
 * @returns true if valid, false otherwise
 */
export const validateValue = (value: FieldValue, range: FieldRange): boolean => {
  // Parse the DSL string into a structured type
  const parsed = parseRange(range);
  return validateWithParsedRange(value, parsed);
};

/**
 * Validate a field value against a parsed range.
 * This is the internal implementation using structured types.
 */
export const validateWithParsedRange = (value: FieldValue, range: ParsedRange): boolean => {
  const stringValue = Array.isArray(value) ? JSON.stringify(value) : String(value ?? "");

  switch (range.rangeType) {
    case 'scalar':
      return validateScalar(value, stringValue, range);
    case 'array':
      return validateArray(value, stringValue, range);
    case 'enum':
      return range.options.includes(stringValue);
    case 'enum-array':
      return validateEnumArray(value, range);
    case 'pattern':
      try {
        return new RegExp(range.regex).test(stringValue);
      } catch {
        return false;
      }
  }
};

/**
 * Validate a scalar value (string, boolean, integer, url) with optional bounds.
 */
function validateScalar(
  value: FieldValue,
  stringValue: string,
  range: { dataType: string; min?: number; max?: number }
): boolean {
  switch (range.dataType) {
    case 'string':
      // Check length constraints if present
      if (range.min !== undefined && stringValue.length < range.min) return false;
      if (range.max !== undefined && stringValue.length > range.max) return false;
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean";

    case 'boolean':
      if (typeof value === "boolean") return true;
      return stringValue === "true" || stringValue === "false";

    case 'url':
      try {
        new URL(stringValue);
        return true;
      } catch {
        return false;
      }

    case 'integer': {
      const num = typeof value === "number" ? value : Number(stringValue);
      if (!Number.isInteger(num)) return false;
      if (range.min !== undefined && num < range.min) return false;
      if (range.max !== undefined && num > range.max) return false;
      return true;
    }

    default:
      return true;
  }
}

/**
 * Validate an array value with optional size constraints and item type.
 */
function validateArray(
  value: FieldValue,
  stringValue: string,
  range: { itemType: 'string' | 'integer'; minSize?: number; maxSize?: number }
): boolean {
  let arr: unknown[];

  if (Array.isArray(value)) {
    arr = value;
  } else {
    // Try parsing as JSON array
    try {
      const parsed: unknown = JSON.parse(stringValue);
      if (!Array.isArray(parsed)) return false;
      arr = parsed as (string | number | boolean)[];
    } catch {
      return false;
    }
  }

  // Check size constraints
  if (range.minSize !== undefined && arr.length < range.minSize) return false;
  if (range.maxSize !== undefined && arr.length > range.maxSize) return false;

  // Validate item types
  for (const item of arr) {
    if (range.itemType === 'integer') {
      if (typeof item !== 'number' || !Number.isInteger(item)) return false;
    } else if (range.itemType === 'string') {
      if (typeof item !== 'string') return false;
    }
  }

  return true;
}

/**
 * Validate an enum array value - each item must be one of the allowed options.
 */
function validateEnumArray(
  value: FieldValue,
  range: { options: string[]; minSize?: number; maxSize?: number }
): boolean {
  let arr: unknown[];

  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === 'string') {
    // Try parsing as JSON array
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) return false;
      arr = parsed;
    } catch {
      // Not a JSON array, treat as single value - invalid for enum array
      return false;
    }
  } else {
    return false;
  }

  // Check size constraints
  if (range.minSize !== undefined && arr.length < range.minSize) return false;
  if (range.maxSize !== undefined && arr.length > range.maxSize) return false;

  // Validate each item is one of the allowed options
  for (const item of arr) {
    const itemStr = String(item);
    if (!range.options.includes(itemStr)) return false;
  }

  return true;
}

/**
 * Check if a field has empty required properties (example, info, or range).
 */
export const hasEmptyProperty = (field: Field): boolean => {
  return field.example === "" || field.info === "" || field.range === "";
};

/**
 * Sort fields with incomplete properties first, then alphabetically.
 */
export function prioritizeIncompleteFields(fields: Field[]): Field[] {
  return fields.sort((a, b) => {
    const aHasEmpty = hasEmptyProperty(a);
    const bHasEmpty = hasEmptyProperty(b);

    if (aHasEmpty && !bHasEmpty) return -1;
    if (!aHasEmpty && bHasEmpty) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Generate all parent paths for a list of field names.
 * 
 * @example
 * generateParentPaths(['a.b.c', 'a.b.d']) 
 * // Returns ['a', 'a.b', 'a.b.c', 'a.b.d']
 */
export const generateParentPaths = (fieldNames: string[]): string[] => {
  const parentPaths = new Set<string>();

  fieldNames.forEach((fieldName) => {
    const parts = fieldName.split(".");
    for (let i = 1; i <= parts.length; i++) {
      parentPaths.add(parts.slice(0, i).join("."));
    }
  });

  return Array.from(parentPaths).sort();
};

/**
 * Check if a field array contains nested fields.
 */
export const hasNestedFields = (fields: (Field | NestedField)[]): boolean => {
  return fields.some(
    (field) => 'fields' in field && Array.isArray(field.fields) && field.fields.length > 0
  );
};

/**
 * Flatten nested fields into flat Field[] with dot-separated names.
 */
export const flattenNestedFields = (
  fields: NestedField[],
  separator = '.'
): Field[] => {
  const result: Field[] = [];

  const processField = (field: NestedField, prefix: string): void => {
    const fullName = prefix ? `${prefix}${separator}${field.name}` : field.name;

    if (field.fields && field.fields.length > 0) {
      // Process children
      for (const child of field.fields) {
        processField(child, fullName);
      }
    } else {
      // Leaf field - add to results
      result.push({
        name: fullName,
        value: field.value ?? '',
        info: field.info ?? '',
        example: field.example ?? '',
        range: field.range || (field.options ? field.options.join(' / ') : ''),
        link: field.link,
        checked: field.checked,
      });
    }
  };

  for (const field of fields) {
    processField(field, '');
  }

  return result;
};

/**
 * Flatten a nested object into a flat object with dot-separated keys.
 * 
 * @example
 * flattenObject({ a: { b: 1 } }) // Returns { 'a.b': 1 }
 */
export const flattenObject = (
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> => {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + "." : "";
    const value = obj[k];
    
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          Object.assign(acc, flattenObject(item as Record<string, unknown>, `${pre}${k}.${index + 1}`));
        } else {
          acc[`${pre}${k}.${index + 1}`] = item;
        }
      });
    } else if (typeof value === "object" && value !== null) {
      Object.assign(acc, flattenObject(value as Record<string, unknown>, pre + k));
    } else {
      acc[pre + k] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);
};

/**
 * Convert a flattened fields array back to a nested object structure.
 * Only includes checked fields in the output.
 * 
 * @example
 * fieldsToNestedObject([
 *   { name: 'a.b', value: 1, checked: true },
 *   { name: 'a.c', value: 2, checked: true }
 * ])
 * // Returns { a: { b: 1, c: 2 } }
 */
export const fieldsToNestedObject = (fields: Field[]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  
  for (const field of fields) {
    if (!field.checked) continue;
    
    const keys = field.name.split('.');
    let current: Record<string, unknown> = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const nextKey = keys[i + 1];
      
      if (!(key in current)) {
        // Determine if next level should be array or object
        current[key] = /^\d+$/.test(nextKey) ? [] : {};
      }
      current = current[key] as Record<string, unknown>;
    }
    
    const lastKey = keys[keys.length - 1];
    current[lastKey] = field.value;
  }
  
  return result;
};

/**
 * Parse key=value format content (used by .properties, .env, .txt files).
 * Supports comments with # or // and quoted values.
 * 
 * @example
 * parseKeyValueFormat('KEY=value\n# comment\nOTHER="quoted"')
 * // Returns { KEY: 'value', OTHER: 'quoted' }
 */
export const parseKeyValueFormat = (content: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      continue;
    }
    
    const equalsIndex = trimmedLine.indexOf('=');
    if (equalsIndex > 0) {
      const key = trimmedLine.substring(0, equalsIndex).trim();
      let value = trimmedLine.substring(equalsIndex + 1).trim();
      
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      result[key] = value;
    }
  }
  
  return result;
};

/**
 * Convert unknown values from parsed content to FieldValue types.
 * 
 * @example
 * toFieldValues({ key: 'string', num: 123, arr: [1,2] })
 * // Returns { key: 'string', num: 123, arr: [1,2] } with proper types
 */
export const toFieldValues = (obj: Record<string, unknown>): Record<string, FieldValue> => {
  const result: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' || typeof value === 'number' || 
        typeof value === 'boolean' || Array.isArray(value) || value === null) {
      result[key] = value as FieldValue;
    } else if (value === undefined) {
      result[key] = '';
    } else if (typeof value === 'object') {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value as string | number | boolean);
    }
  }
  return result;
};

/**
 * Merge settings values into template fields.
 * Updates existing field values and adds new fields for settings not in template.
 * 
 * @param templateFields - The template's field definitions
 * @param settings - Flattened settings key-value pairs
 * @returns Merged fields array with all settings applied
 */
export const mergeSettingsIntoFields = (
  templateFields: Field[], 
  settings: Record<string, FieldValue>
): Field[] => {
  const fieldsMap = new Map<string, Field>();
  
  // Start with template fields
  for (const field of templateFields) {
    fieldsMap.set(field.name, { ...field, checked: true });
  }
  
  // Merge settings values
  for (const [name, value] of Object.entries(settings)) {
    if (fieldsMap.has(name)) {
      const field = fieldsMap.get(name)!;
      field.value = value;
      field.checked = true;
    } else {
      // New field from settings (not in template)
      fieldsMap.set(name, {
        name,
        value,
        info: '',
        example: '',
        range: '' as FieldRange,
        checked: true,
      });
    }
  }
  
  return Array.from(fieldsMap.values());
};

/**
 * Update fields with values from a settings object.
 * Creates new fields for settings that don't exist in the current field list.
 */
export const updateFields = (
  fields: Field[],
  settings: Record<string, FieldValue>
): Field[] => {
  const fieldNames = fields.map((field) => field.name);

  const updatedFields = fields.map((field) => {
    const value = settings[field.name];
    return {
      ...field,
      value: value !== undefined ? value : field.value,
      checked: value !== undefined ? true : field.checked,
    };
  });

  const newFields = Object.keys(settings)
    .filter((settingName) => !fieldNames.includes(settingName))
    .map((settingName) => ({
      name: settingName,
      value: settings[settingName],
      checked: true,
      info: "",
      example: "",
      range: "" as FieldRange,
    }));

  return [...updatedFields, ...newFields];
};

/**
 * Converts a FieldValue to its string representation for display/editing.
 * 
 * @param value - The field value to convert
 * @returns String representation of the value
 * 
 * @example
 * fieldValueToString("hello")     // "hello"
 * fieldValueToString(123)         // "123"
 * fieldValueToString(true)        // "true"
 * fieldValueToString(["a", "b"])  // '["a","b"]'
 * fieldValueToString(undefined)   // ""
 * fieldValueToString(null)        // ""
 */
export const fieldValueToString = (value: FieldValue | undefined | null): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
};

/**
 * Checks if a field value is empty (for display purposes).
 * 
 * @param value - The field value to check
 * @returns true if the value is considered empty
 * 
 * @example
 * isFieldValueEmpty(undefined)  // true
 * isFieldValueEmpty(null)       // true
 * isFieldValueEmpty("")         // true
 * isFieldValueEmpty("  ")       // true
 * isFieldValueEmpty([])         // true
 * isFieldValueEmpty(0)          // false (numbers are never empty)
 * isFieldValueEmpty(false)      // false (booleans are never empty)
 */
export const isFieldValueEmpty = (value: FieldValue | undefined | null): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  // Numbers and booleans are never considered "empty"
  return false;
};
