#!/usr/bin/env node
/* eslint-disable no-console */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Template } from '@quotentiroler/guido-types';
import { selectRuleSets, validateTemplateRuleSet, ruleSetPasses } from './templateValidation.js';

function printUsage() {
  console.log(`
Usage: npm run validate <template-file> [options]

Options:
  --ruleset <name>    Validate a specific ruleset by name
  --tag <tag>         Validate rulesets with a specific tag
  --all               Validate all rulesets (the default)
  -h, --help          Show this help message

Validates a Guido template file for:
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
  `);
}

interface ParsedArgs {
  templatePath?: string;
  rulesetName?: string;
  tag?: string;
  all: boolean;
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    all: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '--ruleset' && args[i + 1]) {
      result.rulesetName = args[++i];
    } else if (arg === '--tag' && args[i + 1]) {
      result.tag = args[++i];
    } else if (arg === '--all') {
      result.all = true;
    } else if (!arg.startsWith('-')) {
      result.templatePath = arg;
    }
  }

  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.templatePath) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const templatePath = resolve(args.templatePath);

  try {
    const fileContent = readFileSync(templatePath, 'utf-8');
    const template = JSON.parse(fileContent) as Template;

    console.log(`\n📋 Validating template: ${template.name || 'Unknown'}`);
    console.log(`   Version: ${template.version || 'N/A'}`);
    console.log(`   File: ${templatePath}`);
    console.log(`   Total rulesets: ${template.ruleSets?.length || 0}\n`);

    const ruleSetsToValidate = selectRuleSets(template, args);

    if (args.rulesetName && ruleSetsToValidate.length === 0) {
      console.error(`
❌ RuleSet "${args.rulesetName}" not found.`);
      console.error(`   Available rulesets: ${(template.ruleSets || []).map(rs => rs.name).join(', ')}
`);
      process.exit(1);
    }
    if (args.tag && ruleSetsToValidate.length === 0) {
      console.error(`
❌ No rulesets found with tag "${args.tag}".`);
      const allTags = [...new Set((template.ruleSets || []).flatMap(rs => rs.tags || []))];
      console.error(`   Available tags: ${allTags.join(', ') || '(none)'}
`);
      process.exit(1);
    }
    if (ruleSetsToValidate.length === 0) {
      console.log('✅ No rulesets to validate.\n');
      process.exit(0);
    }

    let hasErrors = false;

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

        if (errors.length > 0) {
          console.log('   🔴 Errors:');
          errors.forEach((error: string, index: number) => {
            console.log(`      ${index + 1}. ${error}`);
          });
          console.log();
        }

        if (suggestions.length > 0) {
          console.log('   💡 Optimization suggestions:');
          suggestions.forEach((suggestion: string, index: number) => {
            console.log(`      ${index + 1}. ${suggestion}`);
          });
          console.log();
        }
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
          const actualStr = issue.actual === undefined ? 'undefined' : 
                           issue.actual === null ? 'null' : 
                           typeof issue.actual === 'boolean' ? (issue.actual ? '✓' : '✗') :
                           JSON.stringify(issue.actual);
          const expectedStr = issue.expected === undefined ? 'undefined' : 
                             issue.expected === null ? 'null' :
                             typeof issue.expected === 'boolean' ? (issue.expected ? '✓' : '✗') :
                             JSON.stringify(issue.expected);
          console.log(`      • ${issue.field}: ${issue.property} ${actualStr} → ${expectedStr}`);
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
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.error(`\n❌ Error: File not found: ${templatePath}\n`);
      } else if (error.message.includes('JSON')) {
        console.error(`\n❌ Error: Invalid JSON in template file\n${error.message}\n`);
      } else {
        console.error(`\n❌ Error: ${error.message}\n`);
      }
    } else {
      console.error(`\n❌ Unknown error occurred\n`);
    }
    process.exit(1);
  }
}

main();
