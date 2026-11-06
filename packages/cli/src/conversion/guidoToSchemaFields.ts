import { parseRange, type Field, type FieldValue, type JSONSchema } from '@quotentiroler/guido-types';

const looksLikeRegex = (range: string): boolean => range.startsWith('^') || range.endsWith('$') || range.includes('\\');

const sizeBounds = (minItems?: number, maxItems?: number): Partial<JSONSchema> => ({
  ...(minItems !== undefined ? { minItems } : {}),
  ...(maxItems !== undefined ? { maxItems } : {}),
});

function rangeToJsonSchema(range: string): Partial<JSONSchema> {
  if (!range) return { type: 'string' };
  if (range === 'object') return { type: 'object' };

  const parsed = parseRange(range);
  switch (parsed.rangeType) {
    case 'scalar':
      if (parsed.dataType === 'boolean') return { type: 'boolean' };
      if (parsed.dataType === 'url') return { type: 'string', format: 'uri' };
      if (parsed.dataType === 'integer') {
        return {
          type: 'integer',
          ...(parsed.min !== undefined ? { minimum: parsed.min } : {}),
          ...(parsed.max !== undefined ? { maximum: parsed.max } : {}),
        };
      }
      return {
        type: 'string',
        ...(parsed.min !== undefined ? { minLength: parsed.min } : {}),
        ...(parsed.max !== undefined ? { maxLength: parsed.max } : {}),
      };
    case 'array':
      return { type: 'array', items: { type: parsed.itemType }, ...sizeBounds(parsed.minSize, parsed.maxSize) };
    case 'enum-array':
      return {
        type: 'array',
        items: { type: 'string', enum: parsed.options.map((o) => o.trim()) },
        uniqueItems: true,
        ...sizeBounds(parsed.minSize, parsed.maxSize),
      };
    case 'enum':
      return { type: 'string', enum: parsed.options.map((o) => o.trim()) };
    case 'pattern':
      return looksLikeRegex(range) ? { type: 'string', pattern: range } : { type: 'string' };
  }
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
