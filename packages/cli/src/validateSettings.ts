#!/usr/bin/env node
/* eslint-disable no-console */
import {
  validateSettingsSelection,
  type RuleSetSettingsValidation,
  type SettingsValidationIssue,
} from '@quotentiroler/guido-core';
import type { Template } from '@quotentiroler/guido-types';
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

Validates a settings file as given against a Guido template by:
  1. Evaluating template rules on the settings to determine required fields
  2. Checking all set values against their range constraints and value rules
  3. Reporting missing required fields and invalid values
An empty value counts as unset.

Arguments:
  <template-file>     Path to the Guido template (.guido.json)
  <settings-file>     Path to settings file to validate
                      Supported formats: ${SETTINGS_EXTENSIONS}

Options:
  --ruleset <name>    Use a specific ruleset by name (default: first ruleset)
  --tag <tag>         Validate against every ruleset with this tag, each reported
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

function ruleSetReport(template: Template, { ruleSet, result, passed }: RuleSetSettingsValidation, strict: boolean): string[] {
  const lines: string[] = [];
  if (ruleSet) {
    const rules = template.ruleSets.find((rs) => rs.name === ruleSet)?.rules.length ?? 0;
    lines.push(`📦 RuleSet: "${ruleSet}" (${rules} rules)`);
  }
  lines.push('');

  const errors = result.issues.filter((i) => i.type !== 'warning');
  const warnings = result.issues.filter((i) => i.type === 'warning');
  if (errors.length > 0) {
    lines.push('Errors:', ...errors.map(formatIssue), '');
  }
  if (warnings.length > 0 && (strict || errors.length === 0)) {
    lines.push('Warnings:', ...warnings.map(formatIssue), '');
  }

  const { summary } = result;
  lines.push(`Summary: ${summary.validFields}/${summary.totalFields} valid fields`);
  if (summary.missingRequired > 0) lines.push(`   Missing required: ${summary.missingRequired}`);
  if (summary.invalidValues > 0) lines.push(`   Invalid values: ${summary.invalidValues}`);
  if (summary.warnings > 0) lines.push(`   Warnings: ${summary.warnings}`);

  lines.push('');
  if (!result.isValid) {
    lines.push('❌ Validation failed');
  } else if (!passed) {
    const count = `${summary.warnings} warning${summary.warnings === 1 ? '' : 's'}`;
    lines.push(`❌ Validation failed (--strict): ${count}, and --strict allows none`);
  } else {
    lines.push('✅ Validation passed!');
  }
  return lines;
}

/** The human-readable report and exit code for one result per selected ruleset. */
export function settingsReport(
  template: Template,
  validations: RuleSetSettingsValidation[],
  strict: boolean
): { lines: string[]; exitCode: 0 | 1 } {
  const lines = validations.flatMap((validation, i) => [...(i > 0 ? [''] : []), ...ruleSetReport(template, validation, strict)]);
  const failed = validations.filter((v) => !v.passed);
  if (validations.length > 1) {
    lines.push(
      '',
      failed.length === 0
        ? `✅ Passed all ${validations.length} rulesets`
        : `❌ Failed ${failed.length} of ${validations.length} rulesets: ${failed.map((v) => v.ruleSet).join(', ')}`
    );
  }
  return { lines, exitCode: failed.length === 0 ? 0 : 1 };
}

function jsonReport(validations: RuleSetSettingsValidation[]): unknown {
  const entries = validations.map(({ ruleSet, result, passed }) => ({ ...result, ruleSet, passed }));
  if (entries.length === 1) return entries[0];
  return {
    isValid: entries.every((e) => e.isValid),
    passed: entries.every((e) => e.passed),
    results: entries,
  };
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
    const validations = validateSettingsSelection(
      template,
      settings,
      { rulesetName: options.rulesetName, tag: options.rulesetTag },
      { strict: options.strict }
    );
    const { lines, exitCode } = settingsReport(template, validations, options.strict);

    if (options.json) {
      console.log(JSON.stringify(jsonReport(validations), null, 2));
    } else {
      console.error(`📋 Template: ${template.name || 'Unknown'}`);
      console.error(`📁 Settings: ${options.settingsPath} (${Object.keys(settings).length} fields)`);
      if (options.rulesetTag) {
        console.error(`🏷️  Tag "${options.rulesetTag}" selects ${validations.length} ruleset(s): ${validations.map((v) => v.ruleSet).join(', ')}`);
      }
      lines.forEach((line) => console.error(line));
    }
    process.exit(exitCode);
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
