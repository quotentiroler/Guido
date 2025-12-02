#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * @guido/cli - Validate Settings CLI
 * 
 * Validates a settings file against a Guido template.
 * - Applies rules to determine which fields should be set
 * - Validates field values against their range constraints
 * - Reports missing required fields and invalid values
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, extname } from 'path';
import { 
  applyRules, 
  flattenObject, 
  parseKeyValueFormat,
  toFieldValues,
  mergeSettingsIntoFields,
  validateValue,
  isFieldRequired,
  translateRangeToHumanReadable,
} from '@guido/core';
import type { Template, FieldValue, RuleSet } from '@guido/types';
import * as yaml from 'js-yaml';

interface ValidationIssue {
  field: string;
  type: 'missing' | 'invalid' | 'warning';
  message: string;
  expected?: string;
  actual?: string;
}

interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: {
    totalFields: number;
    validFields: number;
    missingRequired: number;
    invalidValues: number;
    warnings: number;
  };
}

interface ValidateOptions {
  templatePath: string;
  settingsPath: string;
  rulesetName?: string;
  rulesetTag?: string;
  strict: boolean;
  json: boolean;
}

function printUsage() {
  console.log(`
Usage: guido-validate-settings <template-file> <settings-file> [options]

Validates a settings file against a Guido template by:
  1. Applying template rules to determine required fields
  2. Checking all field values against their range constraints
  3. Reporting missing required fields and invalid values

Arguments:
  <template-file>     Path to the Guido template (.guido.json)
  <settings-file>     Path to settings file to validate
                      Supported formats: .json, .yaml, .yml, .properties, .env

Options:
  --ruleset <name>    Use a specific ruleset by name (default: first ruleset)
  --tag <tag>         Use rulesets with a specific tag
  --strict            Fail on warnings (extra fields, etc.)
  --json              Output validation result as JSON
  -h, --help          Show this help message

Exit Codes:
  0                   Validation passed
  1                   Validation failed (missing required or invalid values)
  2                   Error (file not found, invalid format, etc.)

Examples:
  # Validate a JSON settings file
  guido-validate-settings template.guido.json appsettings.json

  # Validate with a specific ruleset
  guido-validate-settings template.guido.json config.yaml --ruleset "Production"

  # Output as JSON for CI/CD
  guido-validate-settings template.guido.json settings.json --json
  `);
}

function parseArgs(args: string[]): ValidateOptions | null {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return null;
  }

  const options: ValidateOptions = {
    templatePath: '',
    settingsPath: '',
    strict: false,
    json: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--ruleset' && args[i + 1]) {
      options.rulesetName = args[++i];
    } else if (arg === '--tag' && args[i + 1]) {
      options.rulesetTag = args[++i];
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--json') {
      options.json = true;
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
  if (!options.settingsPath) {
    console.error('Error: Settings file is required');
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
  
  if (ext === '.json') {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const flattened = flattenObject(parsed);
    return toFieldValues(flattened);
  }
  
  if (ext === '.yaml' || ext === '.yml') {
    const parsed = yaml.load(content) as Record<string, unknown>;
    const flattened = flattenObject(parsed);
    return toFieldValues(flattened);
  }
  
  if (ext === '.properties' || ext === '.env' || ext === '.txt') {
    const parsed = parseKeyValueFormat(content);
    return toFieldValues(parsed);
  }
  
  throw new Error(`Unsupported settings format: ${ext}. Supported: .json, .yaml, .yml, .properties, .env`);
}

function findRuleSet(template: Template, options: ValidateOptions): RuleSet | null {
  const allRuleSets = template.ruleSets || [];
  
  if (allRuleSets.length === 0) {
    return null;
  }
  
  if (options.rulesetName) {
    const found = allRuleSets.find(rs => 
      rs.name.toLowerCase() === options.rulesetName!.toLowerCase()
    );
    if (!found) {
      throw new Error(`RuleSet "${options.rulesetName}" not found. Available: ${allRuleSets.map(rs => rs.name).join(', ')}`);
    }
    return found;
  }
  
  if (options.rulesetTag) {
    const found = allRuleSets.find(rs => 
      rs.tags?.some(t => t.toLowerCase() === options.rulesetTag!.toLowerCase())
    );
    if (!found) {
      const allTags = [...new Set(allRuleSets.flatMap(rs => rs.tags || []))];
      throw new Error(`No rulesets found with tag "${options.rulesetTag}". Available tags: ${allTags.join(', ') || '(none)'}`);
    }
    return found;
  }
  
  return allRuleSets[0];
}

function validateSettings(
  template: Template,
  settings: Record<string, FieldValue>,
  ruleSet: RuleSet | null
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const rules = ruleSet?.rules || [];
  
  // Merge settings into template fields
  const fields = mergeSettingsIntoFields(template.fields, settings);
  
  // Apply rules to determine which fields should be enabled
  const { updatedFields } = applyRules(fields, rules);
  
  // Create sets for lookup
  const settingsKeys = new Set(Object.keys(settings));
  
  let validFields = 0;
  let missingRequired = 0;
  let invalidValues = 0;
  let warnings = 0;
  
  // Check each template field
  for (const field of updatedFields) {
    const hasValue = settingsKeys.has(field.name);
    const isRequired = field.checked === true || isFieldRequired(field.name, rules);
    const value = settings[field.name];
    
    // Check for missing required fields
    if (isRequired && !hasValue) {
      issues.push({
        field: field.name,
        type: 'missing',
        message: `Required field is missing`,
        expected: field.range ? translateRangeToHumanReadable(field.range) : 'any value',
      });
      missingRequired++;
      continue;
    }
    
    // Validate value against range if present
    if (hasValue && field.range && field.range !== 'string') {
      const isValid = validateValue(value, field.range);
      if (!isValid) {
        issues.push({
          field: field.name,
          type: 'invalid',
          message: `Value does not match expected range`,
          expected: translateRangeToHumanReadable(field.range),
          actual: String(value),
        });
        invalidValues++;
        continue;
      }
    }
    
    if (hasValue) {
      validFields++;
    }
  }
  
  // Check for extra fields not in template (warnings)
  const templateFieldNames = new Set(template.fields.map(f => f.name));
  for (const key of settingsKeys) {
    if (!templateFieldNames.has(key)) {
      // Check if it's a child of a known field
      const isChild = [...templateFieldNames].some(name => key.startsWith(name + '.'));
      if (!isChild) {
        issues.push({
          field: key,
          type: 'warning',
          message: `Field not defined in template`,
        });
        warnings++;
      }
    }
  }
  
  return {
    isValid: missingRequired === 0 && invalidValues === 0,
    issues,
    summary: {
      totalFields: settingsKeys.size,
      validFields,
      missingRequired,
      invalidValues,
      warnings,
    },
  };
}

function formatIssue(issue: ValidationIssue): string {
  const icon = issue.type === 'missing' ? '❌' : issue.type === 'invalid' ? '🔴' : '⚠️';
  let msg = `${icon} ${issue.field}: ${issue.message}`;
  if (issue.expected) {
    msg += `\n   Expected: ${issue.expected}`;
  }
  if (issue.actual !== undefined) {
    msg += `\n   Actual: ${issue.actual}`;
  }
  return msg;
}

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (!options) {
    printUsage();
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 2);
  }
  
  try {
    // Load template and settings
    const template = loadTemplate(options.templatePath);
    const settings = loadSettings(options.settingsPath);
    
    if (!options.json) {
      console.error(`📋 Template: ${template.name || 'Unknown'}`);
      console.error(`📁 Settings: ${options.settingsPath} (${Object.keys(settings).length} fields)`);
    }
    
    // Find the ruleset to use
    const ruleSet = findRuleSet(template, options);
    if (!options.json && ruleSet) {
      console.error(`📦 RuleSet: "${ruleSet.name}" (${ruleSet.rules.length} rules)`);
    }
    
    // Validate
    const result = validateSettings(template, settings, ruleSet);
    
    // Output
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('');
      
      // Show issues
      const errors = result.issues.filter(i => i.type !== 'warning');
      const warnings = result.issues.filter(i => i.type === 'warning');
      
      if (errors.length > 0) {
        console.error('Errors:');
        errors.forEach(issue => console.error(formatIssue(issue)));
        console.error('');
      }
      
      if (warnings.length > 0 && (options.strict || errors.length === 0)) {
        console.error('Warnings:');
        warnings.forEach(issue => console.error(formatIssue(issue)));
        console.error('');
      }
      
      // Summary
      const { summary } = result;
      console.error(`Summary: ${summary.validFields}/${summary.totalFields} valid fields`);
      if (summary.missingRequired > 0) {
        console.error(`   Missing required: ${summary.missingRequired}`);
      }
      if (summary.invalidValues > 0) {
        console.error(`   Invalid values: ${summary.invalidValues}`);
      }
      if (summary.warnings > 0) {
        console.error(`   Warnings: ${summary.warnings}`);
      }
      
      if (result.isValid) {
        console.error('\n✅ Validation passed!');
      } else {
        console.error('\n❌ Validation failed');
      }
    }
    
    // Exit code
    if (!result.isValid) {
      process.exit(1);
    }
    if (options.strict && result.summary.warnings > 0) {
      process.exit(1);
    }
    process.exit(0);
    
  } catch (error) {
    if (options.json) {
      console.log(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
    } else {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    process.exit(2);
  }
}

main();
