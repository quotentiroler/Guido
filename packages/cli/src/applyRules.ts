#!/usr/bin/env node
/* eslint-disable no-console */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { applyRules, fieldsToNestedObject, mergeSettingsIntoFields, requireRuleSets, resolveRuleSetRules } from '@quotentiroler/guido-core';
import type { Field, Rule, Template } from '@quotentiroler/guido-types';
import { parseArgv, wantsHelp } from './cliArgs.js';
import { SETTINGS_EXTENSIONS, exitWithUsage, isEntryPoint, loadSettings, loadTemplate } from './cliIO.js';

type OutputFormat = 'json' | 'fields' | 'diff';

interface ApplyOptions {
  templatePath: string;
  settingsPath?: string;
  outputPath?: string;
  rulesetName?: string;
  format: OutputFormat;
  dryRun: boolean;
}

const isOutputFormat = (value: string | undefined): value is OutputFormat =>
  value === 'json' || value === 'fields' || value === 'diff';

const USAGE = `
Usage: guido-apply-rules <template-file> [settings-file] [options]

Applies Guido template rules to a settings file or template fields.

Arguments:
  <template-file>     Path to the Guido template (.guido.json)
  [settings-file]     Path to settings file - if omitted, uses template fields
                      Supported formats: ${SETTINGS_EXTENSIONS}

Options:
  --ruleset <name>     Apply this ruleset and the rules it inherits (default: first ruleset)
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
  `;

export function parseApplyRulesArgs(args: readonly string[]): ApplyOptions | null {
  if (args.length === 0 || wantsHelp(args)) {
    return null;
  }

  const parsed = parseArgv(args, {
    values: [
      { key: 'output', names: ['-o', '--output'] },
      { key: 'format', names: ['-f', '--format'] },
      { key: 'ruleset', names: ['--ruleset'], ignoreWithoutValue: true },
    ],
    flags: [{ key: 'dryRun', names: ['-d', '--dry-run'] }],
  });

  const formats = parsed.values('format');
  const validFormats = formats.filter(isOutputFormat);
  if (validFormats.length < formats.length) {
    console.error(`Invalid format: ${formats.find((format) => !isOutputFormat(format))}. Use: json, fields, or diff`);
    return null;
  }

  const [templatePath, settingsPath] = parsed.positionals.filter((arg) => arg !== '');
  if (!templatePath) {
    console.error('Error: Template file is required');
    return null;
  }

  return {
    templatePath,
    settingsPath,
    outputPath: parsed.value('output'),
    rulesetName: parsed.value('ruleset'),
    format: validFormats.at(-1) ?? 'json',
    dryRun: parsed.flag('dryRun'),
  };
}

/** The rules a ruleset applies, inherited ones included; the first ruleset by default. */
export function rulesToApply(template: Template, rulesetName?: string): Rule[] {
  const [ruleSet] = rulesetName ? requireRuleSets(template, { rulesetName }) : template.ruleSets;
  return ruleSet ? resolveRuleSetRules(template, ruleSet.name) : [];
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
  
  for (const [name] of beforeMap) {
    if (!afterMap.has(name)) {
      lines.push(`- ${name}`);
    }
  }
  
  return lines.length > 0 ? lines.join('\n') : 'No changes';
}

function main() {
  const args = process.argv.slice(2);
  const options = parseApplyRulesArgs(args);
  
  if (!options) {
    exitWithUsage(USAGE, wantsHelp(args), 1);
  }
  
  try {
    const template = loadTemplate(options.templatePath);
    const rules = rulesToApply(template, options.rulesetName);
    console.error(`📋 Template: ${template.name || 'Unknown'} (${rules.length} rules)`);
    
    let fields: Field[];
    if (options.settingsPath) {
      const settings = loadSettings(options.settingsPath, template.fields);
      fields = mergeSettingsIntoFields(template.fields, settings);
      console.error(`📁 Settings: ${Object.keys(settings).length} fields from ${options.settingsPath}`);
    } else {
      fields = template.fields.map(f => ({ ...f, checked: f.checked ?? true }));
      console.error(`📁 Using template's ${fields.length} fields`);
    }
    
    const originalFields = fields.map(f => ({ ...f }));
    
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

if (isEntryPoint(import.meta.url)) main();
