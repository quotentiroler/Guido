import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { toolDefinitions } from './tool-definitions.js';
import { buildInputSchema } from './exports.js';
import { type ToolContext, errorResult, textResult } from './tools/types.js';
import type { FieldValue, RuleSet, Template } from '@quotentiroler/guido-types';
import {
  mergeSettingsIntoFields,
  detectFormat,
  parseSettings,
  CONFIG_FORMATS,
  translateRangeToHumanReadable,
  validateValue,
  resolveRuleSetRules,
  mergeTemplates,
} from '@quotentiroler/guido-core';
import { applyRulesToFields, isFieldRequiredInTemplate } from './template-utils.js';
import { templateToolHandlers, type ToolHandler } from './handlers/index.js';
import { optBoolean, optString, reqString } from './handlers/args.js';

function refBasename(ref: string): string {
  const parts = ref.split(/[\\/]/);
  return parts[parts.length - 1] || ref;
}

const settingsHandlers: Record<string, ToolHandler> = {
  validate_settings: (args, template) => {
    const settingsPath = reqString(args, 'settingsPath');
    const rulesetName = optString(args, 'rulesetName');
    const rulesetTag = optString(args, 'rulesetTag');
    const strict = optBoolean(args, 'strict') ?? false;

    // Load settings file
    const absolutePath = path.resolve(settingsPath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Settings file not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const format = detectFormat(path.basename(settingsPath));
    if (!format) {
      throw new Error(
        `Unsupported settings format: ${settingsPath}. Supported: ${CONFIG_FORMATS.join(', ')}`
      );
    }

    const settings: Record<string, FieldValue> = parseSettings(content, format);

    // Find ruleset
    const allRuleSets = template.ruleSets || [];
    let ruleSet: RuleSet | null = null;
    let ruleSetIndex = 0;
    
    if (rulesetName) {
      ruleSetIndex = allRuleSets.findIndex(rs => rs.name.toLowerCase() === rulesetName.toLowerCase());
      if (ruleSetIndex === -1) {
        throw new Error(`RuleSet "${rulesetName}" not found. Available: ${allRuleSets.map(rs => rs.name).join(', ')}`);
      }
      ruleSet = allRuleSets[ruleSetIndex];
    } else if (rulesetTag) {
      ruleSetIndex = allRuleSets.findIndex(rs => rs.tags?.some(t => t.toLowerCase() === rulesetTag.toLowerCase()));
      if (ruleSetIndex === -1) {
        throw new Error(`No rulesets found with tag "${rulesetTag}"`);
      }
      ruleSet = allRuleSets[ruleSetIndex];
    } else if (allRuleSets.length > 0) {
      ruleSet = allRuleSets[0];
      ruleSetIndex = 0;
    }

    // Get resolved rules (including inherited)
    const rules = ruleSet ? resolveRuleSetRules(template, ruleSetIndex) : [];
    
    // Merge settings into template fields and apply rules
    const fields = mergeSettingsIntoFields(template.fields, settings);
    const { updatedFields } = applyRulesToFields(fields, rules);
    
    // Validate
    interface ValidationIssue {
      field: string;
      type: 'missing' | 'invalid' | 'warning';
      message: string;
      expected?: string;
      actual?: string;
    }
    
    const issues: ValidationIssue[] = [];
    const settingsKeys = new Set(Object.keys(settings));
    
    let validFields = 0;
    let missingRequired = 0;
    let invalidValues = 0;
    let warnings = 0;
    
    for (const field of updatedFields) {
      const hasValue = settingsKeys.has(field.name);
      const fieldIsRequired = field.checked === true || isFieldRequiredInTemplate(template, field.name);
      const value = settings[field.name];
      
      if (fieldIsRequired && !hasValue) {
        issues.push({
          field: field.name,
          type: 'missing',
          message: 'Required field is missing',
          expected: field.range ? translateRangeToHumanReadable(field.range) : 'any value',
        });
        missingRequired++;
        continue;
      }
      
      if (hasValue && field.range && field.range !== 'string') {
        const isValid = validateValue(value, field.range);
        if (!isValid) {
          issues.push({
            field: field.name,
            type: 'invalid',
            message: 'Value does not match expected range',
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
    
    // Check for extra fields not in template
    const templateFieldNames = new Set(template.fields.map(f => f.name));
    for (const key of settingsKeys) {
      if (!templateFieldNames.has(key)) {
        const isChild = [...templateFieldNames].some(name => key.startsWith(name + '.'));
        if (!isChild) {
          issues.push({
            field: key,
            type: 'warning',
            message: 'Field not defined in template',
          });
          warnings++;
        }
      }
    }
    
    const isValid = missingRequired === 0 && invalidValues === 0 && (!strict || warnings === 0);
    
    return {
      valid: isValid,
      settingsFile: settingsPath,
      ruleSet: ruleSet?.name ?? '(none)',
      issues: issues,
      summary: {
        totalFields: settingsKeys.size,
        validFields,
        missingRequired,
        invalidValues,
        warnings,
      },
    };
  },
};

const toolHandlers: Record<string, ToolHandler> = { ...templateToolHandlers, ...settingsHandlers };

// ============================================================================
// Dynamic Tool Registration
// ============================================================================

export function registerAllTools(context: ToolContext): void {
  const { server, store } = context;

  // Register create_template specially - it doesn't load an existing template
  server.registerTool(
    'create_template',
    {
      title: 'Create Template',
      description: 'Create a new guido template file. Use this to start a fresh template when no template exists.',
      inputSchema: {
        filePath: z.string().describe('Path where the new template file will be created'),
        name: z.string().describe('Template name (e.g., "My App Settings")'),
        version: z.string().optional().describe('Template version (default: "1.0.0")'),
        description: z.string().optional().describe('Template description'),
        owner: z.string().optional().describe('Template owner/author'),
        application: z.string().optional().describe('Target application name'),
        setAsActive: z.boolean().optional().describe('Set this as the active template after creation (default: true)'),
      },
    },
    async (args) => {
      try {
        const filePath = reqString(args, 'filePath');
        const resolvedPath = store.resolveRef(filePath);
        const setAsActive = optBoolean(args, 'setAsActive') ?? true;

        if (await store.exists(resolvedPath)) {
          throw new Error(`Template already exists: ${resolvedPath}. Use set_template to switch to it, or other tools to modify it.`);
        }

        // Create new template
        const template: Template = {
          name: reqString(args, 'name'),
          fileName: refBasename(resolvedPath),
          version: (reqString(args, 'version')) || '1.0.0',
          description: (reqString(args, 'description')) || '',
          owner: (reqString(args, 'owner')) || '',
          application: (reqString(args, 'application')) || undefined,
          fields: [],
          ruleSets: [{
            name: 'Default',
            description: 'Default ruleset',
            tags: [],
            rules: [],
          }],
        };
        
        await store.save(resolvedPath, template);

        if (setAsActive) {
          store.setActiveRef(resolvedPath);
        }
        
        return textResult({
          success: true,
          message: `Template created at ${resolvedPath}`,
          isActiveTemplate: setAsActive,
          template: {
            name: template.name,
            fileName: template.fileName,
            version: template.version,
            fieldCount: 0,
            ruleSetCount: 1,
          },
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // Register set_template - switches the active template
  server.registerTool(
    'set_template',
    {
      title: 'Set Active Template',
      description: 'Set the active template file for subsequent operations. Use this to switch between templates or when starting without a --template argument.',
      inputSchema: {
        filePath: z.string().describe('Path to an existing guido.json template file'),
      },
    },
    async (args) => {
      try {
        const filePath = reqString(args, 'filePath');
        const resolvedPath = store.resolveRef(filePath);

        // Load it first, so an unreadable template never becomes the active one.
        const template = await store.load(resolvedPath);

        const previousPath = store.activeRef();
        store.setActiveRef(resolvedPath);

        return textResult({
          success: true,
          message: `Active template set to: ${resolvedPath}`,
          previousTemplate: previousPath && previousPath !== resolvedPath ? previousPath : undefined,
          template: {
            name: template.name,
            fileName: template.fileName,
            version: template.version,
            fieldCount: template.fields.length,
            ruleSetCount: template.ruleSets?.length ?? 0,
          },
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // Register merge_templates - merges another template into the current one
  server.registerTool(
    'merge_templates',
    {
      title: 'Merge Templates',
      description: 'Merge another template into the current template. Fields from the source template override existing fields with the same name. Rules are combined, avoiding duplicates by description.',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the target guido.json template file (current active template if not provided)'),
        sourceTemplatePath: z.string().describe('Path to the source template to merge from'),
      },
    },
    async (args) => {
      try {
        const targetPath = store.resolveRef(optString(args, 'filePath'));
        const sourcePath = store.resolveRef(reqString(args, 'sourceTemplatePath'));

        const targetTemplate = await store.load(targetPath);
        const sourceTemplate = await store.load(sourcePath);

        const mergedTemplate = mergeTemplates(targetTemplate, sourceTemplate);

        await store.save(targetPath, mergedTemplate);

        // Calculate stats
        const newFields = mergedTemplate.fields.length - targetTemplate.fields.length;
        const newRules = (mergedTemplate.ruleSets?.[0]?.rules?.length ?? 0) - (targetTemplate.ruleSets?.[0]?.rules?.length ?? 0);
        
        return textResult({
          success: true,
          message: `Merged template "${sourceTemplate.name}" into "${targetTemplate.name}"`,
          sourceTemplate: {
            name: sourceTemplate.name,
            fieldCount: sourceTemplate.fields.length,
            ruleCount: sourceTemplate.ruleSets?.[0]?.rules?.length ?? 0,
          },
          result: {
            name: mergedTemplate.name,
            fieldCount: mergedTemplate.fields.length,
            ruleSetCount: mergedTemplate.ruleSets?.length ?? 0,
            ruleCount: mergedTemplate.ruleSets?.[0]?.rules?.length ?? 0,
            newFieldsAdded: Math.max(0, newFields),
            newRulesAdded: Math.max(0, newRules),
          },
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  for (const toolDef of toolDefinitions) {
    // Skip special tools - already registered above
    if (toolDef.name === 'create_template' || toolDef.name === 'set_template' || toolDef.name === 'merge_templates') {
      continue;
    }

    const handler = toolHandlers[toolDef.name];
    
    if (!handler) {
      console.error(`No handler found for tool: ${toolDef.name}`);
      continue;
    }

    const inputSchema = buildInputSchema(toolDef.inputs);

    server.registerTool(
      toolDef.name,
      {
        title: toolDef.title,
        description: toolDef.description,
        inputSchema,
      },
      async (args) => {
        try {
          const filePath = optString(args, 'filePath');
          const ref = store.resolveRef(filePath);
          const template = await store.load(ref);

          // Handlers are synchronous: save() marks the template dirty and the
          // single persist happens here, once, after the handler returns.
          let dirty = false;
          const ctx = {
            filePath: ref,
            save: () => {
              dirty = true;
            },
          };

          const result = await handler(args, template, ctx);

          if (dirty) await store.save(ref, template);

          return textResult(result);
        } catch (error) {
          return errorResult(error);
        }
      }
    );
  }

  console.error(`Registered ${toolDefinitions.length} tools dynamically`);
}
