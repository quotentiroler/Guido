#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  type Field,
  type Template,
  type Rule,
  type JSONSchema,
  RuleState,
} from '@quotentiroler/guido-types';
import { parseArgv } from './cliArgs.js';
import { emitConversion, exitWithFileError, exitWithUsage, isEntryPoint } from './cliIO.js';
import { type ConversionContext, convertProperties, mergeAllOf } from './conversion/schemaToGuidoFields.js';
import { collectRequiredFields, collectDependentRequired, collectConditionals, collectDependentSchemas, collectDiscriminatedUnions, collectArrayContains, collectConstFields } from './conversion/schemaToGuidoRules.js';

/** Rules from schema constraints: required → `set` target, conditional → conditions + targets, const → `set_to_value`. */
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

/** Version from a $id URL, e.g. ".../schema/v1.0" → "1.0". */
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
    ...(options.docs || schema.$comment ? { docs: options.docs || (schema.$comment) } : {}),
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

const USAGE = `
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
  `;

export function parseSchemaToGuidoArgs(args: readonly string[]): {
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
  const parsed = parseArgv(args, {
    values: [
      { key: 'output', names: ['-o', '--output'] },
      { key: 'name', names: ['-n', '--name'] },
      { key: 'version', names: ['-v', '--version'] },
      { key: 'owner', names: ['--owner'] },
      { key: 'fileName', names: ['--filename'] },
      { key: 'application', names: ['--application'] },
      { key: 'docs', names: ['--docs'] },
      { key: 'command', names: ['--command'] },
      { key: 'rulesetName', names: ['--ruleset-name'] },
      { key: 'rulesetTags', names: ['--ruleset-tags'] },
    ],
    flags: [{ key: 'stdout', names: ['--stdout'] }],
  });

  return {
    schemaFile: parsed.positionals.at(-1),
    output: parsed.value('output'),
    name: parsed.value('name'),
    version: parsed.value('version'),
    owner: parsed.value('owner'),
    fileName: parsed.value('fileName'),
    application: parsed.value('application'),
    docs: parsed.value('docs'),
    command: parsed.value('command'),
    rulesetName: parsed.value('rulesetName'),
    rulesetTags: parsed.value('rulesetTags')?.split(',').map(t => t.trim()),
    stdout: parsed.flag('stdout'),
    help: parsed.help,
  };
}

function main() {
  const args = parseSchemaToGuidoArgs(process.argv.slice(2));

  if (args.help || !args.schemaFile) {
    exitWithUsage(USAGE, args.help, 1);
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

    const [ruleSet] = template.ruleSets;
    emitConversion({
      output: JSON.stringify(template, null, 2),
      warnings,
      stdout: args.stdout,
      outputPath: args.output || schemaPath.replace(/\.schema\.json$|\.json$/, '.guido.json'),
      summary: [`   Fields: ${template.fields.length}`, `   RuleSet: "${ruleSet.name}" (${ruleSet.rules.length} rules)`],
    });
  } catch (error) {
    exitWithFileError(error, schemaPath);
  }
}

if (isEntryPoint(import.meta.url)) {
  main();
}
