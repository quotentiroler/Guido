#!/usr/bin/env node
/* eslint-disable no-console */
import {
  listRuleSetTags,
  selectRuleSets,
  validateSettings,
  type SettingsValidationIssue,
} from '@quotentiroler/guido-core';
import type { Template, RuleSet } from '@quotentiroler/guido-types';
import { parseArgv, wantsHelp } from './cliArgs.js';
import { SETTINGS_EXTENSIONS, exitWithUsage, isEntryPoint, loadSettings, loadTemplate } from './cliIO.js';

interface ValidateOptions {
  templatePath: string;
  settingsPath: string;
  rulesetName?: string;
  rulesetTag?: string;
  strict: boolean;
  json: boolean;
}

const USAGE = `
Usage: guido-validate-settings <template-file> <settings-file> [options]

Validates a settings file against a Guido template by:
  1. Applying template rules to determine required fields
  2. Checking all field values against their range constraints
  3. Reporting missing required fields and invalid values

Arguments:
  <template-file>     Path to the Guido template (.guido.json)
  <settings-file>     Path to settings file to validate
                      Supported formats: ${SETTINGS_EXTENSIONS}

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
  `;

export function parseValidateSettingsArgs(args: readonly string[]): ValidateOptions | null {
  if (args.length === 0 || wantsHelp(args)) {
    return null;
  }

  const parsed = parseArgv(args, {
    values: [
      { key: 'ruleset', names: ['--ruleset'], ignoreWithoutValue: true },
      { key: 'tag', names: ['--tag'], ignoreWithoutValue: true },
    ],
    flags: [
      { key: 'strict', names: ['--strict'] },
      { key: 'json', names: ['--json'] },
    ],
  });
  const [templatePath = '', settingsPath = ''] = parsed.positionals.filter((arg) => arg !== '');

  if (!templatePath) {
    console.error('Error: Template file is required');
    return null;
  }
  if (!settingsPath) {
    console.error('Error: Settings file is required');
    return null;
  }

  return {
    templatePath,
    settingsPath,
    rulesetName: parsed.value('ruleset'),
    rulesetTag: parsed.value('tag'),
    strict: parsed.flag('strict'),
    json: parsed.flag('json'),
  };
}

function findRuleSet(template: Template, options: ValidateOptions): RuleSet | null {
  const allRuleSets = template.ruleSets || [];
  if (allRuleSets.length === 0) {
    return null;
  }

  const found = selectRuleSets(template, { rulesetName: options.rulesetName, tag: options.rulesetTag }).at(0);
  if (found) {
    return found;
  }
  if (options.rulesetName) {
    throw new Error(`RuleSet "${options.rulesetName}" not found. Available: ${allRuleSets.map(rs => rs.name).join(', ')}`);
  }
  throw new Error(`No rulesets found with tag "${options.rulesetTag}". Available tags: ${listRuleSetTags(template).join(', ') || '(none)'}`);
}

function formatIssue(issue: SettingsValidationIssue): string {
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
  const options = parseValidateSettingsArgs(args);
  
  if (!options) {
    exitWithUsage(USAGE, wantsHelp(args), 2);
  }
  
  try {
    const template = loadTemplate(options.templatePath);
    const settings = loadSettings(options.settingsPath, template.fields);
    
    if (!options.json) {
      console.error(`📋 Template: ${template.name || 'Unknown'}`);
      console.error(`📁 Settings: ${options.settingsPath} (${Object.keys(settings).length} fields)`);
    }
    
    const ruleSet = findRuleSet(template, options);
    if (!options.json && ruleSet) {
      console.error(`📦 RuleSet: "${ruleSet.name}" (${ruleSet.rules.length} rules)`);
    }
    
    const result = validateSettings(template, settings, ruleSet);
    
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('');
      
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

if (isEntryPoint(import.meta.url)) main();
