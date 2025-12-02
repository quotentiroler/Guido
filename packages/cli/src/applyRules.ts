#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * @guido/cli - Apply Rules CLI
 * 
 * Applies Guido template rules to a settings file.
 * Rules can enable/disable fields, set values, or add items to arrays.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, extname } from 'path';
import { 
  applyRules, 
  flattenObject, 
  fieldsToNestedObject,
  parseKeyValueFormat,
  toFieldValues,
  mergeSettingsIntoFields 
} from '@guido/core';
import type { Template, Field, FieldValue } from '@guido/types';
import * as yaml from 'js-yaml';

interface ApplyOptions {
  templatePath: string;
  settingsPath?: string;
  outputPath?: string;
  format: 'json' | 'fields' | 'diff';
  dryRun: boolean;
}

function printUsage() {
  console.log(`
Usage: guido-apply-rules <template-file> [settings-file] [options]

Applies Guido template rules to a settings file or template fields.

Arguments:
  <template-file>     Path to the Guido template (.guido.json)
  [settings-file]     Path to settings file - if omitted, uses template fields
                      Supported formats: .json, .yaml, .yml, .properties, .env, .txt

Options:
  -o, --output <file>  Output file path (default: stdout)
  -f, --format <fmt>   Output format: json | fields | diff (default: json)
  -d, --dry-run        Show what would change without writing
  -h, --help           Show this help message

Examples:
  # Apply rules to a JSON settings file
  guido-apply-rules template.guido.json appsettings.json

  # Apply rules to a YAML settings file
  guido-apply-rules template.guido.json config.yaml

  # Apply rules to environment variables file
  guido-apply-rules template.guido.json .env

  # Apply rules to template's own fields (check defaults)
  guido-apply-rules template.guido.json

  # Show diff of changes
  guido-apply-rules template.guido.json settings.json -f diff

  # Write result to file
  guido-apply-rules template.guido.json settings.json -o output.json
  `);
}

function parseArgs(args: string[]): ApplyOptions | null {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return null;
  }

  const options: ApplyOptions = {
    templatePath: '',
    format: 'json',
    dryRun: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-o' || arg === '--output') {
      options.outputPath = args[++i];
    } else if (arg === '-f' || arg === '--format') {
      const fmt = args[++i];
      if (fmt === 'json' || fmt === 'fields' || fmt === 'diff') {
        options.format = fmt;
      } else {
        console.error(`Invalid format: ${fmt}. Use: json, fields, or diff`);
        return null;
      }
    } else if (arg === '-d' || arg === '--dry-run') {
      options.dryRun = true;
    } else if (!arg.startsWith('-')) {
      if (!options.templatePath) {
        options.templatePath = arg;
      } else if (!options.settingsPath) {
        options.settingsPath = arg;
      }
    }
    i++;
  }

  if (!options.templatePath) {
    console.error('Error: Template file is required');
    return null;
  }

  return options;
}

function loadTemplate(path: string): Template {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Template file not found: ${absolutePath}`);
  }
  const content = readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content) as Template;
}

function loadSettings(path: string): Record<string, FieldValue> {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Settings file not found: ${absolutePath}`);
  }
  const content = readFileSync(absolutePath, 'utf-8');
  const ext = extname(path).toLowerCase();
  
  // JSON format
  if (ext === '.json') {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const flattened = flattenObject(parsed);
    return toFieldValues(flattened);
  }
  
  // YAML format
  if (ext === '.yaml' || ext === '.yml') {
    const parsed = yaml.load(content) as Record<string, unknown>;
    const flattened = flattenObject(parsed);
    return toFieldValues(flattened);
  }
  
  // Properties/env/txt format (key=value)
  if (ext === '.properties' || ext === '.env' || ext === '.txt') {
    const parsed = parseKeyValueFormat(content);
    return toFieldValues(parsed);
  }
  
  throw new Error(`Unsupported settings format: ${ext}. Supported: .json, .yaml, .yml, .properties, .env, .txt`);
}

function formatDiff(before: Field[], after: Field[]): string {
  const lines: string[] = [];
  const beforeMap = new Map(before.map(f => [f.name, f]));
  const afterMap = new Map(after.map(f => [f.name, f]));
  
  for (const [name, afterField] of afterMap) {
    const beforeField = beforeMap.get(name);
    
    if (!beforeField) {
      lines.push(`+ ${name}: ${JSON.stringify(afterField.value)}`);
    } else if (beforeField.checked !== afterField.checked) {
      lines.push(`~ ${name}: checked ${beforeField.checked} → ${afterField.checked}`);
    } else if (JSON.stringify(beforeField.value) !== JSON.stringify(afterField.value)) {
      lines.push(`~ ${name}: ${JSON.stringify(beforeField.value)} → ${JSON.stringify(afterField.value)}`);
    }
  }
  
  // Check for removed fields
  for (const [name] of beforeMap) {
    if (!afterMap.has(name)) {
      lines.push(`- ${name}`);
    }
  }
  
  return lines.length > 0 ? lines.join('\n') : 'No changes';
}

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (!options) {
    printUsage();
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }
  
  try {
    // Load template
    const template = loadTemplate(options.templatePath);
    const rules = template.ruleSets?.[0]?.rules ?? [];
    console.error(`📋 Template: ${template.name || 'Unknown'} (${rules.length} rules)`);
    
    // Get fields to process
    let fields: Field[];
    if (options.settingsPath) {
      const settings = loadSettings(options.settingsPath);
      fields = mergeSettingsIntoFields(template.fields, settings);
      console.error(`📁 Settings: ${Object.keys(settings).length} fields from ${options.settingsPath}`);
    } else {
      fields = template.fields.map(f => ({ ...f, checked: f.checked ?? true }));
      console.error(`📁 Using template's ${fields.length} fields`);
    }
    
    // Store original for diff
    const originalFields = fields.map(f => ({ ...f }));
    
    // Apply rules
    if (rules.length === 0) {
      console.error('ℹ️  No rules to apply');
    } else {
      const result = applyRules(fields, rules);
      fields = result.updatedFields;
      
      const modifiedCount = Object.keys(result.disabledReasons).length;
      if (modifiedCount > 0) {
        console.error(`✅ Applied rules: ${modifiedCount} field(s) affected`);
      } else {
        console.error('✅ Applied rules: no changes needed');
      }
    }
    
    // Format output
    let output: string;
    switch (options.format) {
      case 'fields':
        output = JSON.stringify(fields, null, 2);
        break;
      case 'diff':
        output = formatDiff(originalFields, fields);
        break;
      case 'json':
      default: {
        const nested = fieldsToNestedObject(fields);
        output = JSON.stringify(nested, null, 2);
        break;
      }
    }
    
    // Output
    if (options.outputPath && !options.dryRun) {
      writeFileSync(resolve(options.outputPath), output, 'utf-8');
      console.error(`📝 Written to: ${options.outputPath}`);
    } else {
      if (options.dryRun) {
        console.error('🔍 Dry run - would output:\n');
      }
      console.log(output);
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error('❌ Unknown error occurred');
    }
    process.exit(1);
  }
}

main();
