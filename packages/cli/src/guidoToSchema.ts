#!/usr/bin/env node
import { resolve } from 'path';
import { type Template, type JSONSchema } from '@quotentiroler/guido-types';
import { parseArgv } from './cliArgs.js';
import { emitConversion, exitWithFileError, exitWithUsage, isEntryPoint, readTemplateFile } from './cliIO.js';
import { buildNestedSchema, cleanupSchema } from './conversion/guidoToSchemaFields.js';
import { extractRequiredFields, extractDependentRequired, extractIfThen, extractConstFields, applyDependentRequired, applyIfThen, applyConstFields, applyRequiredFields } from './conversion/guidoToSchemaRules.js';

type SchemaDraft = '07' | '2020-12';

/**
 * Main conversion function: Guido Template → JSON Schema
 */
export function guidoToJsonSchema(template: Template, options: {
  $id?: string;
  draft?: SchemaDraft;
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

const USAGE = `
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
  `;

const isSchemaDraft = (value: string | undefined): value is SchemaDraft => value === '07' || value === '2020-12';

export function parseGuidoToSchemaArgs(args: readonly string[]): {
  guidoFile?: string;
  output?: string;
  $id?: string;
  draft?: SchemaDraft;
  stdout: boolean;
  help: boolean;
} {
  const parsed = parseArgv(args, {
    values: [
      { key: 'output', names: ['-o', '--output'] },
      { key: 'id', names: ['--id'] },
      { key: 'draft', names: ['--draft'] },
    ],
    flags: [{ key: 'stdout', names: ['--stdout'] }],
  });

  return {
    guidoFile: parsed.positionals.at(-1),
    output: parsed.value('output'),
    $id: parsed.value('id'),
    draft: parsed.values('draft').filter(isSchemaDraft).at(-1),
    stdout: parsed.flag('stdout'),
    help: parsed.help,
  };
}

function main() {
  const args = parseGuidoToSchemaArgs(process.argv.slice(2));

  if (args.help || !args.guidoFile) {
    exitWithUsage(USAGE, args.help, 1);
  }

  const guidoPath = resolve(args.guidoFile);

  try {
    console.error(`\n📄 Reading Guido template: ${guidoPath}`);
    
    const template = readTemplateFile(guidoPath);

    console.error(`   Name: ${template.name}`);
    console.error(`   Fields: ${template.fields.length}`);

    console.error(`\n🔄 Converting to JSON Schema...`);

    const { schema, warnings } = guidoToJsonSchema(template, {
      $id: args.$id,
      draft: args.draft,
    });

    emitConversion({
      output: JSON.stringify(schema, null, 2),
      warnings,
      stdout: args.stdout,
      outputPath: args.output || guidoPath.replace(/\.guido\.json$|\.json$/, '.schema.json'),
      summary: [`   Properties: ${Object.keys(schema.properties || {}).length}`],
    });
  } catch (error) {
    exitWithFileError(error, guidoPath);
  }
}

if (isEntryPoint(import.meta.url)) {
  main();
}
