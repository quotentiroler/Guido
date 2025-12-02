#!/usr/bin/env node
/* eslint-disable no-console */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { 
  Field, 
  FieldRange, 
  Template, 
  Rule,
  JSONSchema,
  SchemaConversionContext 
} from '@guido/types';
import { RuleState } from '@guido/types';

/**
 * Safely stringify a value that might be an object
 */
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Extended conversion context for schema-to-guido conversion
 */
interface ConversionContext extends SchemaConversionContext {
  definitions: Record<string, JSONSchema>;
  rootSchema: JSONSchema;
  warnings: string[];
}

/**
 * Resolve a $ref to its schema definition
 */
function resolveRef(ref: string, context: ConversionContext): JSONSchema | null {
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
function fullyResolveSchema(schema: JSONSchema, context: ConversionContext): JSONSchema {
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
function convertProperties(
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
function mergeAllOf(schema: JSONSchema, context: ConversionContext): JSONSchema {
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

/**
 * Collect all required fields from the schema recursively
 * Returns a map of field path -> parent object path (for context)
 */
function collectRequiredFields(
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
function collectDependentRequired(
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
function collectConditionals(
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
function collectDependentSchemas(
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
function collectDiscriminatedUnions(
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
function collectArrayContains(
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
function collectConstFields(
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

/**
 * Generate Guido rules from JSON Schema constraints
 * 
 * Rule structure:
 * - conditions: Array of RuleDomain (when these are satisfied...)
 * - targets: Array of RuleDomain (... then these must be satisfied)
 * 
 * For required fields without conditions, we use a special approach:
 * - targets: [{name: "fieldPath", state: "set"}] means field must be set
 * 
 * For conditionally required fields:
 * - conditions: [{name: "triggerField", state: "set_to_value", value: "X"}]
 * - targets: [{name: "requiredField", state: "set"}]
 * 
 * For const fields:
 * - targets: [{name: "fieldPath", state: "set_to_value", value: "constValue"}]
 */
function generateRules(
  schema: JSONSchema,
  context: ConversionContext,
  fields: Field[]
): Rule[] {
  const rules: Rule[] = [];
  const fieldNames = new Set(fields.map(f => f.name));

  // 1. Generate rules for required fields (always required - no conditions)
  // OPTIMIZATION: Merge all unconditional required fields into a single rule with multiple targets
  const requiredFields = collectRequiredFields(schema, context);
  const unconditionalTargets: Array<{ name: string; state: RuleState }> = [];
  
  for (const [fieldPath] of requiredFields) {
    // Only create rule if field exists in our fields list
    if (fieldNames.has(fieldPath)) {
      unconditionalTargets.push({
        name: fieldPath,
        state: RuleState.Set,
      });
    }
  }
  
  // Create a single rule with all unconditional required fields
  if (unconditionalTargets.length > 0) {
    rules.push({
      targets: unconditionalTargets,
    });
  }

  // 2. Generate rules for dependentRequired (conditionally required)
  const dependencies = collectDependentRequired(schema, context);
  for (const dep of dependencies) {
    // For each trigger field, create a rule that makes dependent fields required
    // when the trigger field has a value
    for (const reqField of dep.requiredFields) {
      if (fieldNames.has(reqField) && fieldNames.has(dep.triggerField)) {
        rules.push({
          conditions: [{
            name: dep.triggerField,
            state: RuleState.Set,
          }],
          targets: [{
            name: reqField,
            state: RuleState.Set,
          }],
        });
      }
    }
  }

  // 3. Generate rules for if/then/else conditionals
  const conditionals = collectConditionals(schema, context);
  for (const cond of conditionals) {
    if (cond.condition && cond.thenRequired.length > 0) {
      // Create rules for fields required when condition is true
      for (const reqField of cond.thenRequired) {
        if (fieldNames.has(reqField) && fieldNames.has(cond.condition.field)) {
          rules.push({
            conditions: [{
              name: cond.condition.field,
              state: RuleState.SetToValue,
              value: String(cond.condition.value),
            }],
            targets: [{
              name: reqField,
              state: RuleState.Set,
            }],
          });
        }
      }
    }

    // Handle else branch - fields required when condition is NOT true
    if (cond.condition && cond.elseRequired.length > 0) {
      for (const reqField of cond.elseRequired) {
        if (fieldNames.has(reqField) && fieldNames.has(cond.condition.field)) {
          rules.push({
            conditions: [{
              name: cond.condition.field,
              state: RuleState.SetToValue,
              value: String(cond.condition.value),
              not: true, // Negate the condition
            }],
            targets: [{
              name: reqField,
              state: RuleState.Set,
            }],
          });
        }
      }
    }
  }

  // 4. Generate rules for dependentSchemas (additional schema when field is set)
  const depSchemas = collectDependentSchemas(schema, context);
  for (const dep of depSchemas) {
    for (const reqField of dep.requiredFields) {
      if (fieldNames.has(reqField) && fieldNames.has(dep.triggerField)) {
        rules.push({
          conditions: [{
            name: dep.triggerField,
            state: RuleState.Set,
          }],
          targets: [{
            name: reqField,
            state: RuleState.Set,
          }],
        });
      }
    }
  }

  // 5. Generate rules for oneOf/anyOf discriminated unions
  const unions = collectDiscriminatedUnions(schema, context);
  for (const union of unions) {
    for (const reqField of union.requiredFields) {
      if (fieldNames.has(reqField) && fieldNames.has(union.discriminatorField)) {
        rules.push({
          conditions: [{
            name: union.discriminatorField,
            state: RuleState.SetToValue,
            value: union.discriminatorValue,
          }],
          targets: [{
            name: reqField,
            state: RuleState.Set,
          }],
        });
      }
    }
  }

  // 6. Generate rules for array contains constraints
  const arrayContains = collectArrayContains(schema, context);
  for (const constraint of arrayContains) {
    if (fieldNames.has(constraint.arrayField)) {
      rules.push({
        targets: [{
          name: constraint.arrayField,
          state: RuleState.Contains,
          value: constraint.mustContain,
        }],
      });
    }
  }

  // 7. Generate rules for const fields (fixed values)
  const constFields = collectConstFields(schema, context);
  for (const constField of constFields) {
    if (fieldNames.has(constField.fieldPath)) {
      rules.push({
        targets: [{
          name: constField.fieldPath,
          state: RuleState.SetToValue,
          value: constField.constValue,
        }],
      });
    }
  }

  return rules;
}

/**
 * Extract version from $id URL if present
 * e.g., "https://example.com/schema/v1.0" → "1.0"
 * e.g., "https://example.com/schema/1.2.3" → "1.2.3"
 */
function extractVersionFromId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  
  // Match version patterns like v1.0, v1.0.0, 1.0, 1.0.0 at end of path
  const versionMatch = id.match(/[/v]?(\d+\.\d+(?:\.\d+)?)[/]?$/i);
  if (versionMatch) {
    return versionMatch[1];
  }
  return undefined;
}

/**
 * Extract owner/organization from $id URL domai
 * e.g., "https://schemas.example.com/..." → "example.com"
 */
function extractOwnerFromId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  
  try {
    const url = new URL(id);
    // Remove common prefixes like 'schemas.', 'api.', 'www.'
    let hostname = url.hostname;
    hostname = hostname.replace(/^(schemas?|api|www)\./, '');
    return hostname;
  } catch {
    return undefined;
  }
}

/**
 * Main conversion function: JSON Schema → Guido Template
 */
export function jsonSchemaToGuido(schema: JSONSchema, options: {
  name?: string;
  version?: string;
  owner?: string;
  fileName?: string;
  application?: string;
  docs?: string;
  command?: string;
  rulesetName?: string;
  rulesetTags?: string[];
} = {}): { template: Template; warnings: string[] } {
  
  const context: ConversionContext = {
    definitions: { ...schema.definitions, ...schema.$defs },
    rootSchema: schema,
    warnings: [],
  };

  // Handle allOf by merging schemas
  let effectiveSchema = schema;
  if (schema.allOf) {
    effectiveSchema = mergeAllOf(schema, context);
  }

  // Extract metadata from schema if not provided via CLI
  const schemaId = schema.$id;
  const inferredVersion = extractVersionFromId(schemaId);
  const inferredOwner = extractOwnerFromId(schemaId);

  const template: Template = {
    name: options.name || schema.title || 'Converted Template',
    version: options.version || inferredVersion || '1.0.0',
    description: schema.description || '',
    owner: options.owner || inferredOwner || '',
    fileName: options.fileName || 'config.json',
    // Optional fields - only include if provided
    ...(options.application && { application: options.application }),
    ...(options.docs || schema.$comment ? { docs: options.docs || (schema.$comment as string) } : {}),
    ...(options.command && { command: options.command }),
    fields: [],
    ruleSets: [{
      name: options.rulesetName || 'Default',
      description: 'Auto-generated from JSON Schema',
      tags: options.rulesetTags || ['generated'],
      rules: [],
    }],
  };

  // Convert properties to flat fields
  if (effectiveSchema.properties) {
    template.fields = convertProperties(effectiveSchema.properties, context);
  }

  // Generate rules from required fields, dependentRequired, and if/then/else
  template.ruleSets[0].rules = generateRules(schema, context, template.fields);

  // Mark fields as checked if they are targets of unconditional rules
  // Also set values for set_to_value rules
  // This ensures the template's default state complies with its own rules
  const unconditionallyRequired = new Set<string>();
  const unconditionalValues = new Map<string, string>();
  
  for (const rule of template.ruleSets[0].rules) {
    // Unconditional rules have no conditions
    if (!rule.conditions || rule.conditions.length === 0) {
      for (const target of rule.targets) {
        unconditionallyRequired.add(target.name);
        // If it's a set_to_value rule, also capture the value
        if (target.state === RuleState.SetToValue && target.value !== undefined) {
          unconditionalValues.set(target.name, target.value);
        }
      }
    }
  }
  
  // Update fields to be checked and have correct values if unconditionally required
  for (const field of template.fields) {
    if (unconditionallyRequired.has(field.name)) {
      field.checked = true;
      // Also set the value if there's an unconditional set_to_value rule
      if (unconditionalValues.has(field.name)) {
        field.value = unconditionalValues.get(field.name)!;
      }
    }
  }

  // Handle anyOf/oneOf as warnings
  if (schema.anyOf) {
    context.warnings.push(
      `Schema uses 'anyOf' which requires manual review. ${schema.anyOf.length} alternatives found.`
    );
  }
  if (schema.oneOf) {
    context.warnings.push(
      `Schema uses 'oneOf' which requires manual review. ${schema.oneOf.length} alternatives found.`
    );
  }

  return { template, warnings: context.warnings };
}

function printUsage() {
  console.log(`
Usage: npx ts-node src/cli/schemaToGuido.ts <schema-file> [options]

Converts a JSON Schema file to a Guido template with flat fields and rules.

Options:
  -o, --output <file>       Output file path (default: <schema-name>.guido.json)
  -n, --name <name>         Template name (default: from schema title)
  -v, --version <version>   Template version (default: from schema $id or 1.0.0)
  --owner <owner>           Template owner (default: from schema $id domain)
  --filename <name>         Output filename hint (e.g., appsettings.json)
  --application <app>       Target application name
  --docs <url>              Link to documentation (default: from schema $comment)
  --command <cmd>           Command to run with the template
  --ruleset-name <name>     Name for the generated ruleset (default: Default)
  --ruleset-tags <tags>     Comma-separated tags for the ruleset (default: generated)
  --stdout                  Print to stdout instead of writing file
  -h, --help                Show this help message

Examples:
  npx ts-node src/cli/schemaToGuido.ts ./schema.json
  npx ts-node src/cli/schemaToGuido.ts ./schema.json -o my-template.guido.json
  npx ts-node src/cli/schemaToGuido.ts ./schema.json --name "My Template" --owner "Me"
  npx ts-node src/cli/schemaToGuido.ts ./schema.json --ruleset-name "Schema Rules" --ruleset-tags "auto,schema"

Output Format (Guido Field):
  {
    "name": "path.to.field",      // Dot-separated path
    "value": "default value",     // Default or empty string
    "info": "Field description",  // From schema description
    "example": "example value",   // Generated from schema
    "range": "integer(1..100)"    // See range types below
  }

Generated Rules:
  - "required" rules from schema's required arrays
  - Conditional "required" rules from dependentRequired
  - Conditional rules from if/then/else constructs

Range Types Generated:
  "string"            ← string without constraints
  "boolean"           ← boolean type
  "integer"           ← integer without bounds
  "integer(min..max)" ← integer with minimum/maximum
  "string(min..max)"  ← string with minLength/maxLength
  "url"               ← format: uri
  "string[]"          ← array of strings
  "integer[]"         ← array of integers
  "opt1||opt2||opt3"  ← enum values
  "^regex$"           ← pattern

Supported JSON Schema features:
  ✓ type (string, number, integer, boolean, object, array)
  ✓ properties → flattened to dot-notation paths
  ✓ enum → range with "opt1||opt2||opt3"
  ✓ default → value field
  ✓ description → info field
  ✓ $ref (local references)
  ✓ $defs, definitions
  ✓ allOf (merged)
  ✓ format (uri → url, etc.)
  ✓ pattern, min/max → range hints
  ✓ required → rules with action: "required"
  ✓ dependentRequired → conditional required rules
  ✓ if/then/else → conditional rules

  ⚠ anyOf, oneOf → warnings (requires manual review)
  `);
}

function parseArgs(args: string[]): {
  schemaFile?: string;
  output?: string;
  name?: string;
  version?: string;
  owner?: string;
  fileName?: string;
  application?: string;
  docs?: string;
  command?: string;
  rulesetName?: string;
  rulesetTags?: string[];
  stdout: boolean;
  help: boolean;
} {
  const result = {
    schemaFile: undefined as string | undefined,
    output: undefined as string | undefined,
    name: undefined as string | undefined,
    version: undefined as string | undefined,
    owner: undefined as string | undefined,
    fileName: undefined as string | undefined,
    application: undefined as string | undefined,
    docs: undefined as string | undefined,
    command: undefined as string | undefined,
    rulesetName: undefined as string | undefined,
    rulesetTags: undefined as string[] | undefined,
    stdout: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '--stdout') {
      result.stdout = true;
    } else if (arg === '-o' || arg === '--output') {
      result.output = args[++i];
    } else if (arg === '-n' || arg === '--name') {
      result.name = args[++i];
    } else if (arg === '-v' || arg === '--version') {
      result.version = args[++i];
    } else if (arg === '--owner') {
      result.owner = args[++i];
    } else if (arg === '--filename') {
      result.fileName = args[++i];
    } else if (arg === '--application') {
      result.application = args[++i];
    } else if (arg === '--docs') {
      result.docs = args[++i];
    } else if (arg === '--command') {
      result.command = args[++i];
    } else if (arg === '--ruleset-name') {
      result.rulesetName = args[++i];
    } else if (arg === '--ruleset-tags') {
      result.rulesetTags = args[++i]?.split(',').map(t => t.trim());
    } else if (!arg.startsWith('-')) {
      result.schemaFile = arg;
    }
  }

  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.schemaFile) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const schemaPath = resolve(args.schemaFile);

  try {
    console.error(`\n📄 Reading JSON Schema: ${schemaPath}`);
    
    const fileContent = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(fileContent) as JSONSchema;

    console.error(`   Title: ${schema.title || 'N/A'}`);
    console.error(`   Properties: ${Object.keys(schema.properties || {}).length}`);
    
    if (schema.definitions || schema.$defs) {
      const defCount = Object.keys(schema.definitions || {}).length + 
                       Object.keys(schema.$defs || {}).length;
      console.error(`   Definitions: ${defCount}`);
    }

    console.error(`\n🔄 Converting to Guido template...`);

    const { template, warnings } = jsonSchemaToGuido(schema, {
      name: args.name,
      version: args.version,
      owner: args.owner,
      fileName: args.fileName,
      application: args.application,
      docs: args.docs,
      command: args.command,
      rulesetName: args.rulesetName,
      rulesetTags: args.rulesetTags,
    });

    // Print warnings
    if (warnings.length > 0) {
      console.error(`\n⚠️  Warnings (${warnings.length}):`);
      warnings.forEach((w, i) => console.error(`   ${i + 1}. ${w}`));
    }

    const output = JSON.stringify(template, null, 2);

    if (args.stdout) {
      console.log(output);
    } else {
      const outputPath = args.output || 
        schemaPath.replace(/\.schema\.json$|\.json$/, '.guido.json');
      
      writeFileSync(outputPath, output, 'utf-8');
      console.error(`\n✅ Generated: ${outputPath}`);
      console.error(`   Fields: ${template.fields.length}`);
      console.error(`   RuleSet: "${template.ruleSets[0].name}" (${template.ruleSets[0].rules.length} rules)`);
    }

    console.error('');
    process.exit(0);

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error(`\n❌ Error: File not found: ${schemaPath}\n`);
      } else if (error.message.includes('JSON')) {
        console.error(`\n❌ Error: Invalid JSON\n${error.message}\n`);
      } else {
        console.error(`\n❌ Error: ${error.message}\n`);
      }
    } else {
      console.error(`\n❌ Unknown error occurred\n`);
    }
    process.exit(1);
  }
}

// Only run main if this is the entry point
if (process.argv[1]?.includes('schemaToGuido')) {
  main();
}
