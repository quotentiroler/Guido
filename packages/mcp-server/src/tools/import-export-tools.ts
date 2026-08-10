/**
 * Import/Export tools for multiple formats
 */
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { CONFIG_FORMATS, detectFormat, parseSettings, serializeFields, type ConfigFormat } from '@quotentiroler/guido-core';
import { type ToolContext } from './types.js';
import type { Field, FieldValue } from '@quotentiroler/guido-types';
import { applyRulesToFields } from '../template-utils.js';

const FORMAT_ENUM = z.enum(CONFIG_FORMATS);

export function registerImportExportTools({ server, store }: ToolContext) {
  // ============================================================================
  // IMPORT SETTINGS
  // ============================================================================
  server.registerTool(
    'import_settings',
    {
      title: 'Import Settings',
      description:
        'Import settings from a file (JSON, YAML, INI, command-line args, .properties, .env, .txt) into the template',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
        settingsPath: z.string().describe('Path to the settings file to import'),
        format: z.enum(['auto', ...CONFIG_FORMATS])
          .optional()
          .describe('File format (default: auto-detect from extension)'),
        mergeMode: z.enum(['update', 'replace', 'addOnly'])
          .optional()
          .describe('How to merge: update (default), replace all, or only add new fields'),
        applyRulesAfter: z.boolean().optional().describe('Apply rules after import (default: true)'),
      },
    },
    async (args) => {
      const filePath = args.filePath as string | undefined;
      const settingsPath = args.settingsPath as string;
      const format = (args.format as string | undefined) ?? 'auto';
      const mergeMode = (args.mergeMode as string | undefined) ?? 'update';
      const applyRulesAfter = (args.applyRulesAfter as boolean | undefined) ?? true;

      const tRef = store.resolveRef(filePath);
      const template = await store.load(tRef);

      // Resolve settings path
      const absoluteSettingsPath = path.resolve(settingsPath);
      if (!fs.existsSync(absoluteSettingsPath)) {
        return {
          content: [{ type: 'text' as const, text: `Settings file not found: ${absoluteSettingsPath}` }],
          isError: true,
        };
      }

      const content = fs.readFileSync(absoluteSettingsPath, 'utf-8');

      const detectedFormat =
        format === 'auto' ? detectFormat(path.basename(settingsPath)) ?? 'json' : (format as ConfigFormat);

      let settings: Record<string, FieldValue>;
      try {
        settings = parseSettings(content, detectedFormat);
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Parse error: ${(error as Error).message}` }],
          isError: true,
        };
      }

      // Track changes
      const changes = {
        updated: [] as string[],
        added: [] as string[],
        unchanged: 0,
      };

      // Merge settings into template
      if (mergeMode === 'replace') {
        // Replace all field values
        for (const field of template.fields) {
          if (field.name in settings) {
            if (JSON.stringify(field.value) !== JSON.stringify(settings[field.name])) {
              field.value = settings[field.name];
              field.checked = true;
              changes.updated.push(field.name);
            } else {
              changes.unchanged++;
            }
          }
        }
      } else {
        // Update or addOnly
        for (const [name, value] of Object.entries(settings)) {
          const existingField = template.fields.find((f: Field) => f.name === name);
          
          if (existingField) {
            if (mergeMode === 'update') {
              if (JSON.stringify(existingField.value) !== JSON.stringify(value)) {
                existingField.value = value;
                existingField.checked = true;
                changes.updated.push(name);
              } else {
                changes.unchanged++;
              }
            }
          } else if (mergeMode === 'addOnly' || mergeMode === 'update') {
            // Add new field
            const newField: Field = {
              name,
              value,
              info: '',
              example: '',
              range: '',
              checked: true,
            };
            template.fields.push(newField);
            changes.added.push(name);
          }
        }
      }

      // Apply rules if requested
      let appliedRulesInfo: string[] = [];
      const rules = template.ruleSets?.[0]?.rules ?? [];
      if (applyRulesAfter && rules.length > 0) {
        const { updatedFields, appliedRules } = applyRulesToFields(template.fields, rules);
        template.fields = updatedFields;
        appliedRulesInfo = appliedRules;
      }

      await store.save(tRef, template);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            format: detectedFormat,
            settingsImported: Object.keys(settings).length,
            updated: changes.updated.length,
            added: changes.added.length,
            unchanged: changes.unchanged,
            updatedFields: changes.updated,
            addedFields: changes.added,
            rulesApplied: appliedRulesInfo.length,
          }, null, 2),
        }],
      };
    }
  );

  // ============================================================================
  // EXPORT CONFIG (MULTI-FORMAT)
  // ============================================================================
  server.registerTool(
    'export_config',
    {
      title: 'Export Configuration',
      description:
        'Export the template as configuration text (JSON, YAML, INI, command-line args, .properties, .env, .txt)',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
        format: FORMAT_ENUM.optional().describe('Output format (default: json)'),
        onlyChecked: z.boolean().optional().describe('Only export checked fields (default: true)'),
        arrayStyle: z.enum(['nargs', 'repeat'])
          .optional()
          .describe("args format only: array values as '--f a b' (nargs, default) or '--f a --f b' (repeat)"),
        outputPath: z.string().optional().describe('Write to file instead of returning'),
      },
    },
    async (args) => {
      const filePath = args.filePath as string | undefined;
      const format = (args.format as ConfigFormat | undefined) ?? 'json';
      const onlyChecked = (args.onlyChecked as boolean | undefined) ?? true;
      const arrayStyle = args.arrayStyle as 'nargs' | 'repeat' | undefined;
      const outputPath = args.outputPath as string | undefined;

      const template = await store.load(store.resolveRef(filePath));
      const fieldsToExport = onlyChecked
        ? template.fields.filter((f: Field) => f.checked)
        : template.fields;

      const output = serializeFields(template.fields, format, { onlyChecked, arrayStyle });

      // Write to file if outputPath provided
      if (outputPath) {
        const absoluteOutput = path.resolve(outputPath);
        fs.writeFileSync(absoluteOutput, output, 'utf-8');
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              format,
              fieldCount: fieldsToExport.length,
              outputPath: absoluteOutput,
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: output,
        }],
      };
    }
  );
}
