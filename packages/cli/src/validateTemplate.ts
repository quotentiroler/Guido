#!/usr/bin/env node
/* eslint-disable no-console */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateRules, applyRules } from '@guido/core';
import { SilentLogger } from '@guido/logger';
import type { Template, RuleSet, Field } from '@guido/types';

function printUsage() {
  console.log(`
Usage: npm run validate <template-file> [options]

Options:
  --ruleset <name>    Validate a specific ruleset by name
  --tag <tag>         Validate rulesets with a specific tag
  --all               Validate all rulesets (default: first ruleset only)
  -h, --help          Show this help message

Validates a Guido template file for:
  - Rule contradictions
  - Circular dependencies
  - Logical conflicts
  - Default field state compliance with rules
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

function findRuleSets(template: Template, args: ParsedArgs): RuleSet[] {
  const allRuleSets = template.ruleSets || [];
  
  if (args.all) {
    return allRuleSets;
  }
  
  if (args.rulesetName) {
    const found = allRuleSets.filter(rs => 
      rs.name.toLowerCase() === args.rulesetName!.toLowerCase()
    );
    if (found.length === 0) {
      console.error(`\n❌ RuleSet "${args.rulesetName}" not found.`);
      console.error(`   Available rulesets: ${allRuleSets.map(rs => rs.name).join(', ')}\n`);
      process.exit(1);
    }
    return found;
  }
  
  if (args.tag) {
    const found = allRuleSets.filter(rs => 
      rs.tags?.some(t => t.toLowerCase() === args.tag!.toLowerCase())
    );
    if (found.length === 0) {
      console.error(`\n❌ No rulesets found with tag "${args.tag}".`);
      const allTags = [...new Set(allRuleSets.flatMap(rs => rs.tags || []))];
      console.error(`   Available tags: ${allTags.join(', ') || '(none)'}\n`);
      process.exit(1);
    }
    return found;
  }
  
  // Default: first ruleset only
  return allRuleSets.length > 0 ? [allRuleSets[0]] : [];
}

/**
 * Check if field states comply with rules (no changes needed on initial load)
 */
function checkFieldCompliance(fields: Field[], ruleSet: RuleSet): { 
  compliant: boolean; 
  issues: Array<{ field: string; property: 'checked' | 'value'; expected: unknown; actual: unknown; reason: string }> 
} {
  const issues: Array<{ field: string; property: 'checked' | 'value'; expected: unknown; actual: unknown; reason: string }> = [];
  
  // Deep clone fields to avoid mutation
  const fieldsCopy = fields.map(f => ({ ...f }));
  
  // Apply rules with silent logger
  const { updatedFields, disabledReasons } = applyRules(fieldsCopy, ruleSet.rules, {
    logger: new SilentLogger(),
  });
  
  // Compare original fields with updated fields
  for (let i = 0; i < fields.length; i++) {
    const original = fields[i];
    const updated = updatedFields[i];
    
    if (original.checked !== updated.checked) {
      issues.push({
        field: original.name,
        property: 'checked',
        expected: updated.checked,
        actual: original.checked,
        reason: disabledReasons[original.name] || 'Rule enforcement',
      });
    }
    
    if (original.value !== updated.value) {
      issues.push({
        field: original.name,
        property: 'value',
        expected: updated.value,
        actual: original.value,
        reason: disabledReasons[original.name] || 'Rule enforcement',
      });
    }
  }
  
  return { compliant: issues.length === 0, issues };
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

    const ruleSetsToValidate = findRuleSets(template, args);
    
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
      console.log(`   Rules: ${ruleSet.rules.length}`);

      if (ruleSet.rules.length === 0) {
        console.log('   ✅ No rules to validate.\n');
        continue;
      }

      const result = validateRules(ruleSet.rules);

      if (result.isValid) {
        console.log('   ✅ Validation passed!');
      } else {
        hasErrors = true;
        console.log('   ❌ Validation failed:\n');

        const errors = result.errors.filter((e: string) => !e.includes('can be merged'));
        const suggestions = result.errors.filter((e: string) => e.includes('can be merged'));

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

      // Check if default field states comply with rules
      const compliance = checkFieldCompliance(template.fields, ruleSet);
      if (!compliance.compliant) {
        hasErrors = true;
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
      } else if (result.isValid) {
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
