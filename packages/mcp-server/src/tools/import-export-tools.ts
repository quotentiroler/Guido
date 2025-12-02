/* eslint-disable @typescript-eslint/require-await */
/**
 * Import/Export tools for multiple formats
 */
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ToolContext } from './types';
import { 
  flattenObject,
  fieldsToNestedObject,
  parseKeyValueFormat,
  toFieldValues,
} from '@guido/core';
import type { Field, FieldValue } from '@guido/types';
import { loadTemplate, saveTemplate, applyRulesToFields } from '../template-utils';

export function registerImportExportTools({ server, getTemplatePath }: ToolContext) {
  // ============================================================================
  // IMPORT SETTINGS
  // ============================================================================
  server.registerTool(
    'import_settings',
    {
      title: 'Import Settings',
      description: 'Import settings from a file (JSON, YAML, .properties, .env) into the template',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
        settingsPath: z.string().describe('Path to the settings file to import'),
        format: z.enum(['auto', 'json', 'yaml', 'properties', 'env'])
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

      const tPath = getTemplatePath(filePath);
      const template = loadTemplate(tPath);

      // Resolve settings path
      const absoluteSettingsPath = path.resolve(settingsPath);
      if (!fs.existsSync(absoluteSettingsPath)) {
        return {
          content: [{ type: 'text' as const, text: `Settings file not found: ${absoluteSettingsPath}` }],
          isError: true,
        };
      }

      const content = fs.readFileSync(absoluteSettingsPath, 'utf-8');
      const ext = path.extname(settingsPath).toLowerCase();

      // Determine format
      let detectedFormat = format;
      if (format === 'auto') {
        if (ext === '.json') detectedFormat = 'json';
        else if (ext === '.yaml' || ext === '.yml') detectedFormat = 'yaml';
        else if (ext === '.properties') detectedFormat = 'properties';
        else if (ext === '.env') detectedFormat = 'env';
        else detectedFormat = 'json'; // default
      }

      // Parse content
      let settings: Record<string, FieldValue>;
      try {
        switch (detectedFormat) {
          case 'json': {
            const jsonParsed = JSON.parse(content) as Record<string, unknown>;
            const flattened = flattenObject(jsonParsed);
            settings = toFieldValues(flattened);
            break;
          }
          case 'yaml': {
            const yamlParsed = yaml.load(content) as Record<string, unknown>;
            const yamlFlattened = flattenObject(yamlParsed);
            settings = toFieldValues(yamlFlattened);
            break;
          }
          case 'properties':
          case 'env': {
            const kvParsed = parseKeyValueFormat(content);
            settings = toFieldValues(kvParsed);
            break;
          }
          default:
            return {
              content: [{ type: 'text' as const, text: `Unknown format: ${detectedFormat}` }],
              isError: true,
            };
        }
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

      saveTemplate(tPath, template);

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
      description: 'Export the template as configuration in various formats (JSON, YAML, properties, env)',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
        format: z.enum(['json', 'yaml', 'properties', 'env'])
          .optional()
          .describe('Output format (default: json)'),
        onlyChecked: z.boolean().optional().describe('Only export checked fields (default: true)'),
        outputPath: z.string().optional().describe('Write to file instead of returning'),
      },
    },
    async (args) => {
      const filePath = args.filePath as string | undefined;
      const format = (args.format as string | undefined) ?? 'json';
      const onlyChecked = (args.onlyChecked as boolean | undefined) ?? true;
      const outputPath = args.outputPath as string | undefined;

      const template = loadTemplate(getTemplatePath(filePath));

      // Filter fields
      const fieldsToExport = onlyChecked
        ? template.fields.filter((f: Field) => f.checked)
        : template.fields;

      let output: string;

      switch (format) {
        case 'json': {
          const nested = fieldsToNestedObject(fieldsToExport);
          output = JSON.stringify(nested, null, 2);
          break;
        }
        case 'yaml': {
          const nestedYaml = fieldsToNestedObject(fieldsToExport);
          output = yaml.dump(nestedYaml, { indent: 2, lineWidth: -1 });
          break;
        }

        case 'properties':
        case 'env':
          // Flat key=value format
          output = fieldsToExport
            .map((f: Field) => {
              const value = typeof f.value === 'string' ? f.value : JSON.stringify(f.value);
              // For .env format, use underscores for nested paths
              const key = format === 'env' 
                ? f.name.replace(/\./g, '_').toUpperCase()
                : f.name;
              return `${key}=${value}`;
            })
            .join('\n');
          break;

        default:
          return {
            content: [{ type: 'text' as const, text: `Unknown format: ${format}` }],
            isError: true,
          };
      }

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
