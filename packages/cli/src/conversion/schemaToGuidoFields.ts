import { type Field, type FieldRange, type JSONSchema, type SchemaConversionContext } from '@quotentiroler/guido-types';

/**
 * Safely stringify a value that might be an object
 */
export function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Extended conversion context for schema-to-guido conversion
 */
export interface ConversionContext extends SchemaConversionContext {
  definitions: Record<string, JSONSchema>;
  rootSchema: JSONSchema;
  warnings: string[];
}

/**
 * Resolve a $ref to its schema definition
 */
export function resolveRef(ref: string, context: ConversionContext): JSONSchema | null {
  if (ref.startsWith('#/')) {
    const path = ref.slice(2).split('/');
    let current: unknown = context.rootSchema;
    
    for (const segment of path) {
      if (current && typeof current === 'object' && segment in current) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return null;
      }
    }
    
    return current as JSONSchema;
  }
  
  context.warnings.push(`External $ref not supported: ${ref}`);
  return null;
}

/**
 * Convert JSON Schema type/constraints to Guido range string
 * Note: const values are NOT handled here - they become rules with set_to_value state
 */
function schemaToRange(schema: JSONSchema): FieldRange {
  // Handle enum as options
  if (schema.enum) {
    return schema.enum.map(v => String(v)).join('||');
  }

  // Note: const is handled separately via collectConstFields -> generateRules
  // This allows const to create a rule rather than misusing range

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  // Handle format-specific types
  if (schema.format) {
    switch (schema.format) {
      case 'uri':
      case 'url':
        return 'url';
      // Other formats (email, date, uuid, etc.) fall through to type-based handling
    }
  }

  switch (type) {
    case 'boolean':
      return 'boolean';
    case 'integer': {
      // Support integer with bounds: integer(min..max)
      if (schema.minimum !== undefined && schema.maximum !== undefined) {
        return `integer(${schema.minimum}..${schema.maximum})`;
      }
      if (schema.minimum !== undefined) {
        return `integer(${schema.minimum}..)`;
      }
      if (schema.maximum !== undefined) {
        return `integer(..${schema.maximum})`;
      }
      return 'integer';
    }
    case 'number': {
      // Support number with bounds: number(min..max)
      if (schema.minimum !== undefined && schema.maximum !== undefined) {
        return `number(${schema.minimum}..${schema.maximum})`;
      }
      if (schema.minimum !== undefined) {
        return `number(${schema.minimum}..)`;
      }
      if (schema.maximum !== undefined) {
        return `number(..${schema.maximum})`;
      }
      // Unbounded number defaults to 'string' (generic type)
      return 'string';
    }
    case 'string': {
      // If there's a regex pattern, use it directly
      if (schema.pattern) {
        return schema.pattern;
      }
      // Support string with length constraints: string(min..max)
      if (schema.minLength !== undefined && schema.maxLength !== undefined) {
        return `string(${schema.minLength}..${schema.maxLength})`;
      }
      if (schema.minLength !== undefined) {
        return `string(${schema.minLength}..)`;
      }
      if (schema.maxLength !== undefined) {
        return `string(..${schema.maxLength})`;
      }
      return 'string';
    }
    case 'array': {
      // Determine item type
      const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      const itemType = itemSchema?.type;
      const baseType = itemType === 'integer' ? 'integer' : 'string';
      
      // Support array with size constraints: type[min..max]
      if (schema.minItems !== undefined && schema.maxItems !== undefined) {
        return `${baseType}[${schema.minItems}..${schema.maxItems}]`;
      }
      if (schema.minItems !== undefined) {
        return `${baseType}[${schema.minItems}..]`;
      }
      if (schema.maxItems !== undefined) {
        return `${baseType}[..${schema.maxItems}]`;
      }
      return `${baseType}[]`;
    }
    case 'object':
      // Objects should be flattened, but if we get here, treat as 'string'
      return 'string';
    default:
      return 'string';
  }
}

/**
 * Get example value from schema
 */
function getExample(schema: JSONSchema): string {
  if (schema.default !== undefined) {
    return typeof schema.default === 'string' 
      ? schema.default 
      : JSON.stringify(schema.default);
  }
  
  if (schema.enum && schema.enum.length > 0) {
    const firstEnum = schema.enum[0];
    return typeof firstEnum === 'object' && firstEnum !== null
      ? JSON.stringify(firstEnum)
      : String(firstEnum);
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  
  // Handle format-specific examples
  if (schema.format) {
    switch (schema.format) {
      case 'uri':
      case 'url':
        return 'https://example.com';
      case 'email':
        return 'user@example.com';
      case 'date':
        return '2024-01-15';
      case 'date-time':
        return '2024-01-15T10:30:00Z';
      case 'time':
        return '10:30:00';
      case 'uuid':
        return '550e8400-e29b-41d4-a716-446655440000';
      case 'ipv4':
        return '192.168.1.1';
      case 'ipv6':
        return '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      case 'hostname':
        return 'example.com';
      case 'duration':
        return 'P1D';
    }
  }
  
  switch (type) {
    case 'boolean':
      return 'true';
    case 'integer':
    case 'number':
      return schema.minimum !== undefined ? String(schema.minimum) : '0';
    case 'string':
      return '';
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    default:
      return '';
  }
}

/**
 * Fully resolve a schema by following $ref and merging allOf
 */
export function fullyResolveSchema(schema: JSONSchema, context: ConversionContext): JSONSchema {
  let resolved = schema;

  // Resolve $ref first
  if (schema.$ref) {
    const ref = resolveRef(schema.$ref, context);
    if (ref) {
      // Merge: ref provides base, schema overrides
      resolved = { ...ref, ...schema, $ref: undefined };
    }
  }

  // Handle allOf by merging all schemas
  if (resolved.allOf && resolved.allOf.length > 0) {
    const merged: JSONSchema = {
      ...resolved,
      allOf: undefined,
      properties: { ...resolved.properties },
      required: [...(resolved.required || [])],
    };

    for (const subSchema of resolved.allOf) {
      const resolvedSub = fullyResolveSchema(subSchema, context);
      
      // Merge type
      if (resolvedSub.type && !merged.type) {
        merged.type = resolvedSub.type;
      }
      
      // Merge properties
      if (resolvedSub.properties) {
        merged.properties = { ...merged.properties, ...resolvedSub.properties };
      }
      
      // Merge required
      if (resolvedSub.required) {
        merged.required = [...(merged.required || []), ...resolvedSub.required];
      }
      
      // Merge description (keep first non-empty)
      if (!merged.description && resolvedSub.description) {
        merged.description = resolvedSub.description;
      }
    }

    resolved = merged;
  }

  return resolved;
}

/**
 * Convert a JSON Schema property to flat Guido Fields
 */
function convertProperty(
  key: string,
  schema: JSONSchema,
  context: ConversionContext,
  parentPath: string = ''
): Field[] {
  const path = parentPath ? `${parentPath}.${key}` : key;
  const fields: Field[] = [];
  
  // Fully resolve the schema (handles $ref and allOf)
  const resolvedSchema = fullyResolveSchema(schema, context);

  const type = Array.isArray(resolvedSchema.type) ? resolvedSchema.type[0] : resolvedSchema.type;

  // Handle nested object - recurse into properties
  if (type === 'object' && resolvedSchema.properties) {
    for (const [propKey, propSchema] of Object.entries(resolvedSchema.properties)) {
      fields.push(...convertProperty(propKey, propSchema, context, path));
    }
    return fields;
  }

  // Handle array with object items - recurse into item properties
  if (type === 'array' && resolvedSchema.items) {
    const itemSchema = Array.isArray(resolvedSchema.items) ? resolvedSchema.items[0] : resolvedSchema.items;
    if (itemSchema && itemSchema.type === 'object' && itemSchema.properties) {
      for (const [propKey, propSchema] of Object.entries(itemSchema.properties)) {
        fields.push(...convertProperty(propKey, propSchema, context, path));
      }
      return fields;
    }
  }

  // Leaf field - create Guido Field
  const field: Field = {
    name: path,
    value: resolvedSchema.default !== undefined 
      ? (typeof resolvedSchema.default === 'string' 
          ? resolvedSchema.default 
          : JSON.stringify(resolvedSchema.default))
      : '',
    info: resolvedSchema.description || '',
    example: getExample(resolvedSchema),
    range: schemaToRange(resolvedSchema),
  };

  fields.push(field);
  return fields;
}

/**
 * Convert JSON Schema properties to flat Guido fields array
 */
export function convertProperties(
  properties: Record<string, JSONSchema>,
  context: ConversionContext,
  parentPath: string = ''
): Field[] {
  const fields: Field[] = [];
  
  for (const [key, prop] of Object.entries(properties)) {
    fields.push(...convertProperty(key, prop, context, parentPath));
  }
  
  return fields;
}

/**
 * Merge allOf schemas into a single schema
 */
export function mergeAllOf(schema: JSONSchema, context: ConversionContext): JSONSchema {
  if (!schema.allOf) return schema;

  const merged: JSONSchema = {
    type: 'object',
    properties: { ...schema.properties },
    required: [...(schema.required || [])],
  };

  for (const subSchema of schema.allOf) {
    let resolved = subSchema;
    if (subSchema.$ref) {
      const ref = resolveRef(subSchema.$ref, context);
      if (ref) resolved = ref;
    }

    if (resolved.properties) {
      merged.properties = { ...merged.properties, ...resolved.properties };
    }
    if (resolved.required) {
      merged.required = [...(merged.required || []), ...resolved.required];
    }
  }

  return merged;
}
