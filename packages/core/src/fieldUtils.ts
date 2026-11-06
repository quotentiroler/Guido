/**
 * @quotentiroler/guido-core - Field Utilities
 * 
 * Pure functions for field validation and manipulation.
 */

import { type Field, type FieldRange, type FieldValue, type NestedField, parseRange, type ParsedRange } from '@quotentiroler/guido-types';

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
      // Reject blank/whitespace: Number('') and Number('   ') coerce to 0, which
      // would otherwise pass as a valid integer and let a missing required number
      // slip through the validation gate.
      if (typeof value !== "number" && stringValue.trim() === "") return false;
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
        range: field.range || (field.options ? field.options.join('||') : ''),
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
      const nextKey = keys[i + 1];
      const slot = containerKey(current, keys[i]);

      if (!(slot in current)) {
        current[slot] = /^\d+$/.test(nextKey) ? [] : {};
      }
      current = current[slot] as Record<string, unknown>;
    }

    current[containerKey(current, keys[keys.length - 1])] = field.value;
  }

  return result;
};

/**
 * Where a path segment lands in its container.
 *
 * flattenObject numbers array items from ONE (`a.1`, `a.2`) so the names read
 * naturally, so rebuilding an array has to subtract that offset again. Writing
 * `a.1` at index 1 was leaving a hole at index 0, which turned a ComfyUI link
 * `["5", 0]` into `[null, "5", 0]` and every other list into one with a null in
 * front. Object keys, including numeric ones like a ComfyUI node id, are used
 * verbatim.
 */
function containerKey(container: Record<string, unknown>, key: string): string {
  if (!Array.isArray(container) || !/^\d+$/.test(key)) return key;
  return String(Math.max(0, Number(key) - 1));
}

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
      result[key] = String(value);
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
        range: '',
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
      range: "",
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
