#!/usr/bin/env node
/* eslint-disable no-console */
import { resolve } from 'path';
import { requireRuleSets, validateFieldSamples } from '@quotentiroler/guido-core';
import { parseArgv } from './cliArgs.js';
import { exitWithFileError, exitWithUsage, isEntryPoint, readTemplateFile } from './cliIO.js';
import { validateTemplateRuleSet, ruleSetPasses } from './templateValidation.js';

const USAGE = `
Usage: npm run validate <template-file> [options]

Options:
  --ruleset <name>    Validate a specific ruleset by name
  --tag <tag>         Validate rulesets with a specific tag
  --all               Validate all rulesets (the default)
  -h, --help          Show this help message

Validates a Guido template file for:
  - Field examples and default values outside their range
  - Rule contradictions
  - Circular dependencies
  - Logical conflicts
  - Default field state compliance with the default (first) ruleset
  - Merge optimization opportunities

Examples:
  npm run validate ./public/templates/my-template.guido.json
  npm run validate ./template.guido.json --ruleset "Security Rules"
  npm run validate ./template.guido.json --tag production
  npm run validate ./template.guido.json --all
  `;

interface ParsedArgs {
  templatePath?: string;
  rulesetName?: string;
  tag?: string;
  all: boolean;
  help: boolean;
}

export function parseValidateTemplateArgs(args: readonly string[]): ParsedArgs {
  const parsed = parseArgv(args, {
    values: [
      { key: 'ruleset', names: ['--ruleset'], ignoreWithoutValue: true },
      { key: 'tag', names: ['--tag'], ignoreWithoutValue: true },
    ],
    flags: [{ key: 'all', names: ['--all'] }],
  });

  return {
    templatePath: parsed.positionals.at(-1),
    rulesetName: parsed.value('ruleset'),
    tag: parsed.value('tag'),
    all: parsed.flag('all'),
    help: parsed.help,
  };
}

function formatFieldState(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return JSON.stringify(value);
}

function printNumbered(heading: string, items: readonly string[]): void {
  if (items.length === 0) return;
  console.log(heading);
  items.forEach((item, index) => console.log(`      ${index + 1}. ${item}`));
  console.log();
}

function main() {
  const args = parseValidateTemplateArgs(process.argv.slice(2));

  if (args.help || !args.templatePath) {
    exitWithUsage(USAGE, args.help, 1);
  }

  const templatePath = resolve(args.templatePath);

  try {
    const template = readTemplateFile(templatePath);

    console.log(`\n📋 Validating template: ${template.name || 'Unknown'}`);
    console.log(`   Version: ${template.version || 'N/A'}`);
    console.log(`   File: ${templatePath}`);
    console.log(`   Total rulesets: ${template.ruleSets?.length || 0}\n`);

    const ruleSetsToValidate = requireRuleSets(template, args);

    const sampleIssues = validateFieldSamples(template.fields);
    let hasErrors = sampleIssues.length > 0;
    if (hasErrors) {
      printNumbered('🔴 Field examples and default values outside their range:', sampleIssues.map((issue) => issue.message));
    } else {
      console.log(`✅ Field examples and default values: all ${template.fields.length} fields fit their range.\n`);
    }

    if (ruleSetsToValidate.length === 0) {
      console.log('✅ No rulesets to validate.\n');
      process.exit(hasErrors ? 1 : 0);
    }

    for (const ruleSet of ruleSetsToValidate) {
      console.log(`📦 RuleSet: "${ruleSet.name}"`);
      if (ruleSet.description) {
        console.log(`   ${ruleSet.description}`);
      }
      if (ruleSet.tags && ruleSet.tags.length > 0) {
        console.log(`   Tags: ${ruleSet.tags.join(', ')}`);
      }
      const validation = validateTemplateRuleSet(template, ruleSet);
      console.log(`   Rules: ${validation.ruleCount}${validation.ruleCount !== ruleSet.rules.length ? ` (${ruleSet.rules.length} own, the rest inherited)` : ''}`);

      if (validation.ruleCount === 0) {
        console.log('   ✅ No rules to validate.\n');
        continue;
      }

      const { errors, suggestions, compliance } = validation;
      const rulesValid = errors.length === 0 && suggestions.length === 0;
      if (!ruleSetPasses(validation)) hasErrors = true;

      if (rulesValid) {
        console.log('   ✅ Validation passed!');
      } else {
        console.log('   ❌ Validation failed:\n');

        printNumbered('   🔴 Errors:', errors);
        printNumbered('   💡 Optimization suggestions:', suggestions);
      }

      if (!compliance.compliant && !validation.isDefault) {
        console.log('   Note: selecting this ruleset changes these fields from the template defaults:');
        for (const issue of compliance.issues) {
          console.log(`      • ${issue.field}: ${issue.property} → ${JSON.stringify(issue.expected)}`);
        }
        console.log();
      } else if (!compliance.compliant) {
        console.log('   ⚠️  Field compliance issues (fields would be modified on load):');
        for (const issue of compliance.issues) {
          console.log(`      • ${issue.field}: ${issue.property} ${formatFieldState(issue.actual)} → ${formatFieldState(issue.expected)}`);
          console.log(`        Reason: ${issue.reason}`);
        }
        console.log();
        console.log('   💡 Fix: Set these fields to their expected states in the template,');
        console.log('      or use --schema-to-guido to regenerate with correct defaults.\n');
      } else if (rulesValid) {
        console.log('   ✅ Field compliance: all fields match rule expectations.\n');
      }
    }

    process.exit(hasErrors ? 1 : 0);

  } catch (error) {
    exitWithFileError(error, templatePath, 'Invalid JSON in template file');
  }
}

if (isEntryPoint(import.meta.url)) main();
