import { type JSONSchema } from '@quotentiroler/guido-types';
import { safeStringify, type ConversionContext, resolveRef, fullyResolveSchema, mergeAllOf } from './schemaToGuidoFields.js';

/**
 * Collect all required fields from the schema recursively
 * Returns a map of field path -> parent object path (for context)
 */
export function collectRequiredFields(
  schema: JSONSchema,
  context: ConversionContext,
  parentPath: string = ''
): Map<string, string> {
  const requiredMap = new Map<string, string>();

  // Fully resolve the schema (handles $ref and allOf)
  const effectiveSchema = fullyResolveSchema(schema, context);

  // Collect required at this level
  if (effectiveSchema.required && effectiveSchema.properties) {
    for (const reqField of effectiveSchema.required) {
      const fieldPath = parentPath ? `${parentPath}.${reqField}` : reqField;
      requiredMap.set(fieldPath, parentPath);
    }
  }

  // Recurse into nested objects
  if (effectiveSchema.properties) {
    for (const [key, propSchema] of Object.entries(effectiveSchema.properties)) {
      const propPath = parentPath ? `${parentPath}.${key}` : key;
      
      // Fully resolve the property schema
      const resolved = fullyResolveSchema(propSchema, context);

      if (resolved.type === 'object' && resolved.properties) {
        const nested = collectRequiredFields(resolved, context, propPath);
        nested.forEach((v, k) => requiredMap.set(k, v));
      }

      // Handle array items
      if (resolved.type === 'array' && resolved.items) {
        const items = Array.isArray(resolved.items) ? resolved.items[0] : resolved.items;
        const itemSchema = items ? fullyResolveSchema(items, context) : null;
        if (itemSchema && itemSchema.type === 'object' && itemSchema.properties) {
          const nested = collectRequiredFields(itemSchema, context, propPath);
          nested.forEach((v, k) => requiredMap.set(k, v));
        }
      }
    }
  }

  return requiredMap;
}

/**
 * Collect dependentRequired constraints from the schema
 * Returns array of { triggerField, requiredFields[] }
 */
export function collectDependentRequired(
  schema: JSONSchema,
  context: ConversionContext,
  parentPath: string = ''
): Array<{ triggerField: string; requiredFields: string[]; parentPath: string }> {
  const dependencies: Array<{ triggerField: string; requiredFields: string[]; parentPath: string }> = [];

  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, context);
    if (resolved) {
      return collectDependentRequired(resolved, context, parentPath);
    }
    return dependencies;
  }

  // Handle allOf
  let effectiveSchema = schema;
  if (schema.allOf) {
    effectiveSchema = mergeAllOf(schema, context);
  }

  // Collect dependentRequired at this level
  if (effectiveSchema.dependentRequired) {
    for (const [triggerField, reqFields] of Object.entries(effectiveSchema.dependentRequired)) {
      const triggerPath = parentPath ? `${parentPath}.${triggerField}` : triggerField;
      const reqPaths = reqFields.map(f => parentPath ? `${parentPath}.${f}` : f);
      dependencies.push({
        triggerField: triggerPath,
        requiredFields: reqPaths,
        parentPath,
      });
    }
  }

  // Recurse into nested objects
  if (effectiveSchema.properties) {
    for (const [key, propSchema] of Object.entries(effectiveSchema.properties)) {
      const propPath = parentPath ? `${parentPath}.${key}` : key;
      let resolved = propSchema;
      
      if (propSchema.$ref) {
        const ref = resolveRef(propSchema.$ref, context);
        if (ref) resolved = ref;
      }

      if (resolved.type === 'object') {
        const nested = collectDependentRequired(resolved, context, propPath);
        dependencies.push(...nested);
      }
    }
  }

  return dependencies;
}

/**
 * Collect if/then/else conditional schemas
 */
export function collectConditionals(
  schema: JSONSchema,
  context: ConversionContext,
  parentPath: string = ''
): Array<{
  condition: { field: string; value: unknown } | null;
  thenRequired: string[];
  elseRequired: string[];
  parentPath: string;
}> {
  const conditionals: Array<{
    condition: { field: string; value: unknown } | null;
    thenRequired: string[];
    elseRequired: string[];
    parentPath: string;
  }> = [];

  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, context);
    if (resolved) {
      return collectConditionals(resolved, context, parentPath);
    }
    return conditionals;
  }

  // Handle if/then/else at this level
  if (schema.if) {
    let condition: { field: string; value: unknown } | null = null;
    
    // Try to extract a simple condition (property equals value)
    if (schema.if.properties) {
      const propEntries = Object.entries(schema.if.properties);
      if (propEntries.length === 1) {
        const [propName, propSchema] = propEntries[0];
        const propPath = parentPath ? `${parentPath}.${propName}` : propName;
        
        if (propSchema.const !== undefined) {
          condition = { field: propPath, value: propSchema.const };
        } else if (propSchema.enum && propSchema.enum.length === 1) {
          condition = { field: propPath, value: propSchema.enum[0] };
        }
      }
    }

    const thenRequired: string[] = [];
    const elseRequired: string[] = [];

    if (schema.then?.required) {
      thenRequired.push(...schema.then.required.map(f => 
        parentPath ? `${parentPath}.${f}` : f
      ));
    }

    if (schema.else?.required) {
      elseRequired.push(...schema.else.required.map(f => 
        parentPath ? `${parentPath}.${f}` : f
      ));
    }

    if (thenRequired.length > 0 || elseRequired.length > 0) {
      conditionals.push({ condition, thenRequired, elseRequired, parentPath });
    }
  }

  // Handle allOf which may contain conditionals
  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      const nested = collectConditionals(subSchema, context, parentPath);
      conditionals.push(...nested);
    }
  }

  // Recurse into nested objects
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propPath = parentPath ? `${parentPath}.${key}` : key;
      let resolved = propSchema;
      
      if (propSchema.$ref) {
        const ref = resolveRef(propSchema.$ref, context);
        if (ref) resolved = ref;
      }

      if (resolved.type === 'object') {
        const nested = collectConditionals(resolved, context, propPath);
        conditionals.push(...nested);
      }
    }
  }

  return conditionals;
}

/**
 * Collect dependentSchemas - when a property is set, additional schema constraints apply
 */
export function collectDependentSchemas(
  schema: JSONSchema,
  context: ConversionContext,
  parentPath: string = ''
): Array<{ triggerField: string; requiredFields: string[]; parentPath: string }> {
  const dependencies: Array<{ triggerField: string; requiredFields: string[]; parentPath: string }> = [];

  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, context);
    if (resolved) {
      return collectDependentSchemas(resolved, context, parentPath);
    }
    return dependencies;
  }

  // Collect dependentSchemas at this level
  const depSchemas = (schema as Record<string, unknown>).dependentSchemas as Record<string, JSONSchema> | undefined;
  if (depSchemas) {
    for (const [triggerField, depSchema] of Object.entries(depSchemas)) {
      const triggerPath = parentPath ? `${parentPath}.${triggerField}` : triggerField;
      
      // Extract required fields from the dependent schema
      if (depSchema.required) {
        const reqPaths = depSchema.required.map(f => parentPath ? `${parentPath}.${f}` : f);
        dependencies.push({
          triggerField: triggerPath,
          requiredFields: reqPaths,
          parentPath,
        });
      }
    }
  }

  // Recurse into nested objects
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propPath = parentPath ? `${parentPath}.${key}` : key;
      let resolved = propSchema;
      
      if (propSchema.$ref) {
        const ref = resolveRef(propSchema.$ref, context);
        if (ref) resolved = ref;
      }

      if (resolved.type === 'object') {
        const nested = collectDependentSchemas(resolved, context, propPath);
        dependencies.push(...nested);
      }
    }
  }

  return dependencies;
}

/**
 * Collect oneOf/anyOf discriminated unions
 * These create rules like: if type = "email" → email field is required
 */
export function collectDiscriminatedUnions(
  schema: JSONSchema,
  context: ConversionContext,
  parentPath: string = ''
): Array<{
  discriminatorField: string;
  discriminatorValue: string;
  requiredFields: string[];
  parentPath: string;
}> {
  const unions: Array<{
    discriminatorField: string;
    discriminatorValue: string;
    requiredFields: string[];
    parentPath: string;
  }> = [];

  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, context);
    if (resolved) {
      return collectDiscriminatedUnions(resolved, context, parentPath);
    }
    return unions;
  }

  // Process oneOf and anyOf
  const alternatives = [...(schema.oneOf || []), ...(schema.anyOf || [])];
  
  for (const alternative of alternatives) {
    let resolved = alternative;
    if (alternative.$ref) {
      const ref = resolveRef(alternative.$ref, context);
      if (ref) resolved = ref;
    }

    // Look for a discriminator pattern: a property with const value
    if (resolved.properties) {
      for (const [propName, propSchema] of Object.entries(resolved.properties)) {
        const propPath = parentPath ? `${parentPath}.${propName}` : propName;
        
        if (propSchema.const !== undefined) {
          // This is a discriminator field
          const discriminatorValue = safeStringify(propSchema.const);
          
          // Collect required fields for this variant
          const reqFields = (resolved.required || []).filter(f => f !== propName);
          if (reqFields.length > 0) {
            unions.push({
              discriminatorField: propPath,
              discriminatorValue,
              requiredFields: reqFields.map(f => parentPath ? `${parentPath}.${f}` : f),
              parentPath,
            });
          }
        }
      }
    }
  }

  // Recurse into nested objects
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propPath = parentPath ? `${parentPath}.${key}` : key;
      let resolved = propSchema;
      
      if (propSchema.$ref) {
        const ref = resolveRef(propSchema.$ref, context);
        if (ref) resolved = ref;
      }

      if (resolved.type === 'object') {
        const nested = collectDiscriminatedUnions(resolved, context, propPath);
        unions.push(...nested);
      }
    }
  }

  return unions;
}

/**
 * Collect array contains constraints
 * These create rules that an array must contain certain values
 */
export function collectArrayContains(
  schema: JSONSchema,
  context: ConversionContext,
  parentPath: string = ''
): Array<{
  arrayField: string;
  mustContain: string;
  parentPath: string;
}> {
  const constraints: Array<{
    arrayField: string;
    mustContain: string;
    parentPath: string;
  }> = [];

  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, context);
    if (resolved) {
      return collectArrayContains(resolved, context, parentPath);
    }
    return constraints;
  }

  // Check for contains at this level (if this is an array schema)
  const contains = (schema as Record<string, unknown>).contains as JSONSchema | undefined;
  if (schema.type === 'array' && contains) {
    if (contains.const !== undefined) {
      constraints.push({
        arrayField: parentPath,
        mustContain: safeStringify(contains.const),
        parentPath,
      });
    } else if (contains.enum && contains.enum.length === 1) {
      constraints.push({
        arrayField: parentPath,
        mustContain: safeStringify(contains.enum[0]),
        parentPath,
      });
    }
  }

  // Recurse into properties
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propPath = parentPath ? `${parentPath}.${key}` : key;
      let resolved = propSchema;
      
      if (propSchema.$ref) {
        const ref = resolveRef(propSchema.$ref, context);
        if (ref) resolved = ref;
      }

      // Check array properties for contains
      if (resolved.type === 'array') {
        const arrayContains = (resolved as Record<string, unknown>).contains as JSONSchema | undefined;
        if (arrayContains) {
          if (arrayContains.const !== undefined) {
            constraints.push({
              arrayField: propPath,
              mustContain: safeStringify(arrayContains.const),
              parentPath: parentPath,
            });
          } else if (arrayContains.enum && arrayContains.enum.length === 1) {
            constraints.push({
              arrayField: propPath,
              mustContain: safeStringify(arrayContains.enum[0]),
              parentPath: parentPath,
            });
          }
        }
      }

      // Recurse into nested objects
      if (resolved.type === 'object') {
        const nested = collectArrayContains(resolved, context, propPath);
        constraints.push(...nested);
      }
    }
  }

  return constraints;
}

/**
 * Collect fields with const values from the schema
 * These create rules that a field must have a specific fixed value
 */
export function collectConstFields(
  schema: JSONSchema,
  context: ConversionContext,
  parentPath: string = ''
): Array<{
  fieldPath: string;
  constValue: string;
}> {
  const constFields: Array<{
    fieldPath: string;
    constValue: string;
  }> = [];

  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, context);
    if (resolved) {
      return collectConstFields(resolved, context, parentPath);
    }
    return constFields;
  }

  // Handle allOf
  let effectiveSchema = schema;
  if (schema.allOf) {
    effectiveSchema = mergeAllOf(schema, context);
  }

  // Check for const at this level
  if (effectiveSchema.const !== undefined && parentPath) {
    constFields.push({
      fieldPath: parentPath,
      constValue: safeStringify(effectiveSchema.const),
    });
  }

  // Recurse into properties
  if (effectiveSchema.properties) {
    for (const [key, propSchema] of Object.entries(effectiveSchema.properties)) {
      const propPath = parentPath ? `${parentPath}.${key}` : key;
      let resolved = propSchema;

      if (propSchema.$ref) {
        const ref = resolveRef(propSchema.$ref, context);
        if (ref) resolved = ref;
      }

      // Check if this property has a const value
      if (resolved.const !== undefined) {
        constFields.push({
          fieldPath: propPath,
          constValue: safeStringify(resolved.const),
        });
      }

      // Recurse into nested objects
      if (resolved.type === 'object' && resolved.properties) {
        const nested = collectConstFields(resolved, context, propPath);
        constFields.push(...nested);
      }

      // Handle array items
      if (resolved.type === 'array' && resolved.items) {
        const items = Array.isArray(resolved.items) ? resolved.items[0] : resolved.items;
        if (items && items.type === 'object' && items.properties) {
          const nested = collectConstFields(items, context, propPath);
          constFields.push(...nested);
        }
      }
    }
  }

  return constFields;
}
