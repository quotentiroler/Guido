#!/usr/bin/env node
/* eslint-disable no-console */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Field, FieldValue, Template, Rule, JSONSchema } from '@guido/types';
import { RuleState } from '@guido/types';

/**
 * Convert Guido range DSL string to JSON Schema constraints.
 * 
 * Note: This is different from parseRange() in @guido/types which parses
 * to ParsedRange objects. This function converts directly to JSON Schema.
 */
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

  // Legacy: Array with item type (e.g., 'array string', 'array integer')
  const legacyArrayMatch = range.match(/^array\s+(\w+)$/);
  if (legacyArrayMatch) {
    const itemType = legacyArrayMatch[1];
    return { 
      type: 'array', 
      items: { type: itemType === 'string' ? 'string' : itemType === 'integer' ? 'integer' : 'string' }
    };
  }

  // Legacy: Array (generic)
  if (range === 'array') {
    return { type: 'array' };
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

  // Legacy: Options (slash-separated) → enum
  if (range.includes(' / ')) {
    const options = range.split(' / ').map(o => o.trim());
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
function buildNestedSchema(fields: Field[]): JSONSchema {
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
function cleanupSchema(schema: JSONSchema): void {
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
 * Extract unconditionally required fields from Guido rules
 * These are rules with no conditions and a target with state: "set"
 */
function extractRequiredFields(rules: Rule[]): Set<string> {
  const required = new Set<string>();
  
  for (const rule of rules) {
    // Only unconditional rules (no conditions or empty conditions)
    if (!rule.conditions || rule.conditions.length === 0) {
      for (const target of rule.targets) {
        // Target must be "set" state (meaning field must be filled)
        if (target.state === RuleState.Set && !target.not) {
          required.add(target.name);
        }
      }
    }
  }
  
  return required;
}

/**
 * Extract conditional rules that can be converted to dependentRequired
 * Pattern: if fieldA is set → fieldB is required
 */
function extractDependentRequired(rules: Rule[]): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  
  for (const rule of rules) {
    // Must have exactly one condition with state "set" and no negation
    if (rule.conditions?.length === 1) {
      const cond = rule.conditions[0];
      if (cond.state === RuleState.Set && !cond.not && !cond.value) {
        // Collect all targets that are "set" requirements
        for (const target of rule.targets) {
          if (target.state === RuleState.Set && !target.not) {
            // Get the parent path for both condition and target
            const condParent = getParentPath(cond.name);
            const targetParent = getParentPath(target.name);
            
            // dependentRequired only works within the same object level
            if (condParent === targetParent) {
              // Note: condField and targetField would be used for nested object support
              // const condField = getFieldName(cond.name);
              // const targetField = getFieldName(target.name);
              
              if (!deps.has(cond.name)) {
                deps.set(cond.name, new Set());
              }
              deps.get(cond.name)!.add(target.name);
            }
          }
        }
      }
    }
  }
  
  return deps;
}

/**
 * Extract conditional rules that require if/then (no else in Guido)
 * Pattern: if fieldA equals value (AND fieldB equals value2...) → targets required
 * Multiple conditions are AND-chained
 */
function extractIfThen(rules: Rule[]): Array<{
  conditions: Array<{ field: string; value: string }>;
  requiredFields: string[];
  parentPath: string;
}> {
  const conditionals: Array<{
    conditions: Array<{ field: string; value: string }>;
    requiredFields: string[];
    parentPath: string;
  }> = [];
  
  for (const rule of rules) {
    // Must have at least one condition with state "set_to_value"
    if (rule.conditions && rule.conditions.length > 0) {
      // Check all conditions are set_to_value with values and no negation
      const validConditions = rule.conditions.filter(
        c => c.state === RuleState.SetToValue && c.value && !c.not
      );
      
      if (validConditions.length === rule.conditions.length && validConditions.length > 0) {
        // All conditions must be at the same parent level
        const firstParent = getParentPath(validConditions[0].name);
        const allSameParent = validConditions.every(
          c => getParentPath(c.name) === firstParent
        );
        
        if (allSameParent) {
          const requiredFields: string[] = [];
          
          // Collect all targets that are "set" requirements at the same level
          for (const target of rule.targets) {
            if (target.state === RuleState.Set && !target.not) {
              const targetParent = getParentPath(target.name);
              if (targetParent === firstParent) {
                requiredFields.push(getFieldName(target.name));
              }
            }
          }
          
          if (requiredFields.length > 0) {
            conditionals.push({
              conditions: validConditions.map(c => ({
                field: getFieldName(c.name),
                value: c.value!,
              })),
              requiredFields,
              parentPath: firstParent,
            });
          }
        }
      }
    }
  }
  
  return conditionals;
}

/**
 * Extract const rules - fields that must have a specific value
 * Pattern: fieldA must be set to "value" (unconditional)
 */
function extractConstFields(rules: Rule[]): Map<string, string> {
  const consts = new Map<string, string>();
  
  for (const rule of rules) {
    // Only unconditional rules
    if (!rule.conditions || rule.conditions.length === 0) {
      for (const target of rule.targets) {
        if (target.state === RuleState.SetToValue && target.value && !target.not) {
          consts.set(target.name, target.value);
        }
      }
    }
  }
  
  return consts;
}

/**
 * Get the parent path from a field path
 */
function getParentPath(path: string): string {
  const parts = path.split('.');
  parts.pop();
  return parts.join('.');
}

/**
 * Get the field name from a full path
 */
function getFieldName(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1];
}

/**
 * Apply dependentRequired to the schema at the correct nesting level
 */
function applyDependentRequired(
  schema: JSONSchema, 
  deps: Map<string, Set<string>>
): void {
  // Group by parent path
  const depsByParent = new Map<string, Map<string, string[]>>();
  
  for (const [triggerPath, requiredPaths] of deps) {
    const parentPath = getParentPath(triggerPath);
    const triggerField = getFieldName(triggerPath);
    
    if (!depsByParent.has(parentPath)) {
      depsByParent.set(parentPath, new Map());
    }
    
    const requiredFields = Array.from(requiredPaths).map(getFieldName);
    depsByParent.get(parentPath)!.set(triggerField, requiredFields);
  }
  
  // Apply at each level
  for (const [parentPath, fieldDeps] of depsByParent) {
    const target = navigateToPath(schema, parentPath);
    if (target) {
      if (!target.dependentRequired) {
        target.dependentRequired = {};
      }
      for (const [trigger, required] of fieldDeps) {
        target.dependentRequired[trigger] = required;
      }
    }
  }
}

/**
 * Apply if/then conditionals to the schema (no else - Guido doesn't support it)
 * Multiple conditions in the same rule are AND-chained using allOf in the if clause
 */
function applyIfThen(
  schema: JSONSchema,
  conditionals: Array<{
    conditions: Array<{ field: string; value: string }>;
    requiredFields: string[];
    parentPath: string;
  }>
): void {
  // Group by parent path
  const condsByParent = new Map<string, Array<{
    conditions: Array<{ field: string; value: string }>;
    requiredFields: string[];
  }>>();
  
  for (const cond of conditionals) {
    if (!condsByParent.has(cond.parentPath)) {
      condsByParent.set(cond.parentPath, []);
    }
    condsByParent.get(cond.parentPath)!.push({
      conditions: cond.conditions,
      requiredFields: cond.requiredFields,
    });
  }
  
  // Apply at each level using allOf to combine multiple if/then rules
  for (const [parentPath, conds] of condsByParent) {
    const target = navigateToPath(schema, parentPath);
    if (target) {
      if (!target.allOf) {
        target.allOf = [];
      }
      
      for (const cond of conds) {
        // Build the if clause - AND-chain multiple conditions using allOf
        let ifClause: JSONSchema;
        
        if (cond.conditions.length === 1) {
          // Single condition - simple if
          ifClause = {
            properties: {
              [cond.conditions[0].field]: { const: cond.conditions[0].value }
            }
          };
        } else {
          // Multiple conditions - AND-chain with allOf inside if
          ifClause = {
            allOf: cond.conditions.map(c => ({
              properties: {
                [c.field]: { const: c.value }
              }
            }))
          };
        }
        
        target.allOf.push({
          if: ifClause,
          then: {
            required: cond.requiredFields
          }
          // Note: no else - Guido doesn't support else clauses
        });
      }
    }
  }
}

/**
 * Apply const values to the schema
 */
function applyConstFields(
  schema: JSONSchema,
  consts: Map<string, string>
): void {
  for (const [fieldPath, constValue] of consts) {
    const parentPath = getParentPath(fieldPath);
    const fieldName = getFieldName(fieldPath);
    const target = navigateToPath(schema, parentPath);
    
    if (target?.properties?.[fieldName]) {
      target.properties[fieldName].const = constValue;
      // Remove default if const is set
      delete target.properties[fieldName].default;
    }
  }
}

/**
 * Apply required fields to the schema at the correct nesting level
 */
function applyRequiredFields(schema: JSONSchema, requiredFields: Set<string>): void {
  // Group required fields by their parent path
  const requiredByParent = new Map<string, string[]>();
  
  for (const fieldPath of requiredFields) {
    const parts = fieldPath.split('.');
    const fieldName = parts.pop()!;
    const parentPath = parts.join('.');
    
    if (!requiredByParent.has(parentPath)) {
      requiredByParent.set(parentPath, []);
    }
    requiredByParent.get(parentPath)!.push(fieldName);
  }
  
  // Apply required arrays at each level
  for (const [parentPath, fieldNames] of requiredByParent) {
    const target = navigateToPath(schema, parentPath);
    if (target && target.properties) {
      // Only add fields that actually exist in the schema
      const validRequired = fieldNames.filter(name => target.properties![name]);
      if (validRequired.length > 0) {
        target.required = [...(target.required || []), ...validRequired];
      }
    }
  }
}

/**
 * Navigate to a nested path in the schema
 */
function navigateToPath(schema: JSONSchema, path: string): JSONSchema | undefined {
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

/**
 * Main conversion function: Guido Template → JSON Schema
 */
export function guidoToJsonSchema(template: Template, options: {
  $id?: string;
  draft?: '07' | '2020-12';
} = {}): { schema: JSONSchema; warnings: string[] } {
  
  const warnings: string[] = [];

  const draft = options.draft || '07';
  const schemaUrl = draft === '2020-12' 
    ? 'https://json-schema.org/draft/2020-12/schema'
    : 'http://json-schema.org/draft-07/schema#';

  // Build nested structure from flat fields
  const nestedSchema = buildNestedSchema(template.fields);

  // Extract and apply rules to schema
  const rules = template.ruleSets?.[0]?.rules ?? [];
  if (rules.length > 0) {
    // 1. Unconditional required fields
    const requiredFields = extractRequiredFields(rules);
    if (requiredFields.size > 0) {
      applyRequiredFields(nestedSchema, requiredFields);
    }
    
    // 2. Const fields (unconditional set_to_value)
    const constFields = extractConstFields(rules);
    if (constFields.size > 0) {
      applyConstFields(nestedSchema, constFields);
    }
    
    // 3. DependentRequired (if field is set → other fields required)
    const dependentRequired = extractDependentRequired(rules);
    if (dependentRequired.size > 0) {
      applyDependentRequired(nestedSchema, dependentRequired);
    }
    
    // 4. If/then conditionals (if field equals value → fields required)
    // Note: Guido doesn't support else, only if/then
    // Multiple conditions are AND-chained
    const ifThenRules = extractIfThen(rules);
    if (ifThenRules.length > 0) {
      applyIfThen(nestedSchema, ifThenRules);
    }
    
    // Count rules that couldn't be converted
    const convertedRuleCount = 
      (requiredFields.size > 0 ? 1 : 0) + // All unconditional required in one rule
      constFields.size +
      dependentRequired.size +
      ifThenRules.length;
    
    const unconvertedCount = rules.length - convertedRuleCount;
    if (unconvertedCount > 0) {
      warnings.push(
        `${unconvertedCount} rule(s) could not be fully converted to JSON Schema. ` +
        `Complex conditions or cross-level dependencies may need manual review.`
      );
    }
  }

  const schema: JSONSchema = {
    $schema: schemaUrl,
    title: template.name,
    description: template.description || undefined,
    ...nestedSchema,
  };

  if (options.$id) {
    schema.$id = options.$id;
  }

  // Clean up empty required arrays etc.
  cleanupSchema(schema);

  return { schema, warnings };
}

function printUsage() {
  console.log(`
Usage: npx ts-node src/cli/guidoToSchema.ts <guido-file> [options]

Converts a Guido template to a JSON Schema.

Options:
  -o, --output <file>     Output file path (default: <template-name>.schema.json)
  --id <uri>              Schema $id URI
  --draft <version>       JSON Schema draft (07 or 2020-12, default: 07)
  --stdout                Print to stdout instead of writing file
  -h, --help              Show this help message

Examples:
  npx ts-node src/cli/guidoToSchema.ts ./template.guido.json
  npx ts-node src/cli/guidoToSchema.ts ./template.guido.json -o schema.json
  npx ts-node src/cli/guidoToSchema.ts ./template.guido.json --draft 2020-12

Input Format (Guido Field):
  {
    "name": "path.to.field",      // Dot-separated path → nested properties
    "value": "default value",     // → default
    "info": "description",        // → description
    "range": "boolean"            // → type, format, enum
  }

Range → JSON Schema Mapping:
  "string"            → { type: "string" }
  "boolean"           → { type: "boolean" }
  "integer"           → { type: "integer" }
  "integer(0..100)"   → { type: "integer", minimum: 0, maximum: 100 }
  "string(1..255)"    → { type: "string", minLength: 1, maxLength: 255 }
  "url"               → { type: "string", format: "uri" }
  "string[]"          → { type: "array", items: { type: "string" } }
  "integer[]"         → { type: "array", items: { type: "integer" } }
  "a||b||c"           → { type: "string", enum: ["a", "b", "c"] }
  "^regex$"           → { type: "string", pattern: "^regex$" }
  `);
}

function parseArgs(args: string[]): {
  guidoFile?: string;
  output?: string;
  $id?: string;
  draft?: '07' | '2020-12';
  stdout: boolean;
  help: boolean;
} {
  const result = {
    guidoFile: undefined as string | undefined,
    output: undefined as string | undefined,
    $id: undefined as string | undefined,
    draft: undefined as '07' | '2020-12' | undefined,
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
    } else if (arg === '--id') {
      result.$id = args[++i];
    } else if (arg === '--draft') {
      const draft = args[++i];
      if (draft === '07' || draft === '2020-12') {
        result.draft = draft;
      }
    } else if (!arg.startsWith('-')) {
      result.guidoFile = arg;
    }
  }

  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.guidoFile) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const guidoPath = resolve(args.guidoFile);

  try {
    console.error(`\n📄 Reading Guido template: ${guidoPath}`);
    
    const fileContent = readFileSync(guidoPath, 'utf-8');
    const template = JSON.parse(fileContent) as Template;

    console.error(`   Name: ${template.name}`);
    console.error(`   Fields: ${template.fields.length}`);

    console.error(`\n🔄 Converting to JSON Schema...`);

    const { schema, warnings } = guidoToJsonSchema(template, {
      $id: args.$id,
      draft: args.draft,
    });

    // Print warnings
    if (warnings.length > 0) {
      console.error(`\n⚠️  Warnings (${warnings.length}):`);
      warnings.forEach((w, i) => console.error(`   ${i + 1}. ${w}`));
    }

    const output = JSON.stringify(schema, null, 2);

    if (args.stdout) {
      console.log(output);
    } else {
      const outputPath = args.output || 
        guidoPath.replace(/\.guido\.json$|\.json$/, '.schema.json');
      
      writeFileSync(outputPath, output, 'utf-8');
      console.error(`\n✅ Generated: ${outputPath}`);
      console.error(`   Properties: ${Object.keys(schema.properties || {}).length}`);
    }

    console.error('');
    process.exit(0);

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error(`\n❌ Error: File not found: ${guidoPath}\n`);
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
if (process.argv[1]?.includes('guidoToSchema')) {
  main();
}
