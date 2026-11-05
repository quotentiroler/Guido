import { type Field, type FieldValue, type JSONSchema } from '@quotentiroler/guido-types';

/** Guido range DSL → JSON Schema constraints (parseRange() in guido-types yields ParsedRange instead). */
function rangeToJsonSchema(range: string): Partial<JSONSchema> {
  if (!range || range === 'string') {
    return { type: 'string' };
  }

  // Boolean
  if (range === 'boolean') {
    return { type: 'boolean' };
  }

  // URL
  if (range === 'url') {
    return { type: 'string', format: 'uri' };
  }

  // Unbounded string
  if (range === 'string') {
    return { type: 'string' };
  }

  // Integer with bounds: integer(min..max), integer(min..), integer(..max)
  const intRangeMatch = range.match(/^integer\((?:(\d+)\.\.|(\d+)\.\.(\d+)|\.\.?(\d+))\)$/);
  if (intRangeMatch) {
    const result: Partial<JSONSchema> = { type: 'integer' };
    if (intRangeMatch[1] !== undefined) {
      // integer(min..)
      result.minimum = parseInt(intRangeMatch[1]);
    } else if (intRangeMatch[2] !== undefined && intRangeMatch[3] !== undefined) {
      // integer(min..max)
      result.minimum = parseInt(intRangeMatch[2]);
      result.maximum = parseInt(intRangeMatch[3]);
    } else if (intRangeMatch[4] !== undefined) {
      // integer(..max)
      result.maximum = parseInt(intRangeMatch[4]);
    }
    return result;
  }

  // Integer (unbounded)
  if (range === 'integer') {
    return { type: 'integer' };
  }

  // String with length bounds: string(min..max), string(min..), string(..max)
  const strRangeMatch = range.match(/^string\((?:(\d+)\.\.|(\d+)\.\.(\d+)|\.\.?(\d+))\)$/);
  if (strRangeMatch) {
    const result: Partial<JSONSchema> = { type: 'string' };
    if (strRangeMatch[1] !== undefined) {
      // string(min..)
      result.minLength = parseInt(strRangeMatch[1]);
    } else if (strRangeMatch[2] !== undefined && strRangeMatch[3] !== undefined) {
      // string(min..max)
      result.minLength = parseInt(strRangeMatch[2]);
      result.maxLength = parseInt(strRangeMatch[3]);
    } else if (strRangeMatch[4] !== undefined) {
      // string(..max)
      result.maxLength = parseInt(strRangeMatch[4]);
    }
    return result;
  }

  // Enum array: (opt1||opt2||opt3)[] or (opt1||opt2)[min..max]
  const enumArrayMatch = range.match(/^\(([^)]+)\)\[(\d*)\.\.?(\d*)\]$/);
  if (enumArrayMatch) {
    const options = enumArrayMatch[1].split('||').map(o => o.trim());
    const result: Partial<JSONSchema> = {
      type: 'array',
      items: { type: 'string', enum: options },
      uniqueItems: true, // Enum arrays typically shouldn't have duplicates
    };
    if (enumArrayMatch[2]) {
      result.minItems = parseInt(enumArrayMatch[2]);
    }
    if (enumArrayMatch[3]) {
      result.maxItems = parseInt(enumArrayMatch[3]);
    }
    return result;
  }

  // Array types: string[], integer[], string[min..max], integer[min..max]
  const arrayMatch = range.match(/^(string|integer)\[(?:(\d+)\.\.|(\d+)\.\.(\d+)|\.\.?(\d+))?\]$/);
  if (arrayMatch) {
    const itemType = arrayMatch[1];
    const result: Partial<JSONSchema> = { 
      type: 'array', 
      items: { type: itemType } 
    };
    if (arrayMatch[2] !== undefined) {
      // type[min..]
      result.minItems = parseInt(arrayMatch[2]);
    } else if (arrayMatch[3] !== undefined && arrayMatch[4] !== undefined) {
      // type[min..max]
      result.minItems = parseInt(arrayMatch[3]);
      result.maxItems = parseInt(arrayMatch[4]);
    } else if (arrayMatch[5] !== undefined) {
      // type[..max]
      result.maxItems = parseInt(arrayMatch[5]);
    }
    return result;
  }

  // Object
  if (range === 'object') {
    return { type: 'object' };
  }

  // Options (|| separated) → enum
  if (range.includes('||')) {
    const options = range.split('||').map(o => o.trim());
    return { type: 'string', enum: options };
  }

  // Regex pattern (if it looks like a regex)
  if (range.startsWith('^') || range.endsWith('$') || range.includes('\\')) {
    return { type: 'string', pattern: range };
  }

  // Default to string
  return { type: 'string' };
}

/**
 * Parse a value to appropriate type for JSON Schema default
 */
function parseValue(value: FieldValue, range: string): unknown {
  if (value === undefined || value === null || value === '') return undefined;

  // If value is already the correct type, use it directly
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value;

  // Handle string values
  const strValue = String(value);

  if (range === 'boolean') {
    return strValue === 'true';
  }

  if (range === 'integer' || range.startsWith('integer')) {
    const num = parseInt(strValue);
    return isNaN(num) ? undefined : num;
  }

  if (range === 'number' || range.startsWith('number')) {
    const num = parseFloat(strValue);
    return isNaN(num) ? undefined : num;
  }

  if (range === 'array') {
    try {
      return JSON.parse(strValue);
    } catch {
      return undefined;
    }
  }

  if (range === 'object') {
    try {
      return JSON.parse(strValue);
    } catch {
      return undefined;
    }
  }

  return strValue;
}

/**
 * Build nested schema structure from flat fields
 */
export function buildNestedSchema(fields: Field[]): JSONSchema {
  const root: JSONSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  for (const field of fields) {
    const parts = field.name.split('.');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.properties) {
        current.properties = {};
      }

      if (isLast) {
        // Create the leaf property
        const schemaProps = rangeToJsonSchema(field.range);
        const prop: JSONSchema = {
          ...schemaProps,
        };

        if (field.info) {
          prop.description = field.info;
        }

        if (field.value) {
          const parsedValue = parseValue(field.value, field.range);
          if (parsedValue !== undefined) {
            prop.default = parsedValue;
          }
        }

        current.properties[part] = prop;
      } else {
        // Create or navigate to intermediate object
        if (!current.properties[part]) {
          current.properties[part] = {
            type: 'object',
            properties: {},
          };
        }
        current = current.properties[part];
      }
    }
  }

  // Clean up empty required arrays
  cleanupSchema(root);

  return root;
}

/**
 * Remove empty properties and required arrays
 */
export function cleanupSchema(schema: JSONSchema): void {
  if (schema.required && schema.required.length === 0) {
    delete schema.required;
  }

  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      cleanupSchema(prop);
    }
  }

  if (schema.items) {
    if (Array.isArray(schema.items)) {
      schema.items.forEach(cleanupSchema);
    } else {
      cleanupSchema(schema.items);
    }
  }
}

/**
 * Get the parent path from a field path
 */
export function getParentPath(path: string): string {
  const parts = path.split('.');
  parts.pop();
  return parts.join('.');
}

/**
 * Get the field name from a full path
 */
export function getFieldName(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1];
}

/**
 * Navigate to a nested path in the schema
 */
export function navigateToPath(schema: JSONSchema, path: string): JSONSchema | undefined {
  if (!path) return schema;
  
  const parts = path.split('.');
  let current: JSONSchema | undefined = schema;
  
  for (const part of parts) {
    if (!current?.properties?.[part]) {
      return undefined;
    }
    current = current.properties[part];
  }
  
  return current;
}
