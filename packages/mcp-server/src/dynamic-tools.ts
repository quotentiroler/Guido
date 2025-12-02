/* eslint-disable @typescript-eslint/require-await */
/**
 * Dynamic MCP Tool Registration
 * 
 * Registers tools dynamically from tool-definitions.ts.
 * This eliminates the need for code generation while keeping
 * tool definitions declarative.
 */
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { toolDefinitions, InputType, InputDef } from './tool-definitions.js';
import { ToolContext } from './tools/types.js';
// Types only (no Zod bundled)
import type { Field, Rule, RuleDomain, Template, FieldValue, RuleSet } from '@guido/types';
import { RuleState } from '@guido/types';
// Zod schemas for runtime validation (MCP server needs these)
import { 
  RuleDomainSchema,
  RuleSchema,
  RuleUpdateSchema,
  FieldSchema,
  FieldValueSchema,
  FieldUpdateSchema,
} from '@guido/types/schemas';
import { 
  validateRules, 
  translateRule, 
  validateValue,
  flattenObject,
  parseKeyValueFormat,
  toFieldValues,
  mergeSettingsIntoFields,
  translateRangeToHumanReadable,
  getDefaultRules,
  resolveRuleSetRules,
  getRuleSetInheritanceChain,
  validateRuleSetInheritance,
  mergeTemplates,
} from '@guido/core';
import { 
  loadTemplate, 
  saveTemplate, 
  findField, 
  findFieldIndex,
  applyRulesToFields,
  getAffectedFields,
  isFieldRequiredInTemplate,
} from './template-utils.js';

// ============================================================================
// Input Type to Zod Schema Mapping
// ============================================================================

function inputTypeToZod(type: InputType, required: boolean): z.ZodType {
  let schema: z.ZodType;
  
  switch (type) {
    case 'string': schema = z.string(); break;
    case 'number': schema = z.number(); break;
    case 'boolean': schema = z.boolean(); break;
    case 'string[]': schema = z.array(z.string()); break;
    case 'FieldValue': schema = FieldValueSchema; break;
    case 'RuleDomain': schema = RuleDomainSchema; break;
    case 'RuleDomain[]': schema = z.array(RuleDomainSchema); break;
    case 'Field': schema = FieldSchema; break;
    case 'FieldUpdate': schema = FieldUpdateSchema; break;
    case 'FieldUpdate[]': schema = z.array(FieldUpdateSchema); break;
    case 'Rule': schema = RuleSchema; break;
    case 'RuleUpdate': schema = RuleUpdateSchema; break;
    default: schema = z.unknown();
  }
  
  return required ? schema : schema.optional();
}

function buildInputSchema(inputs: Record<string, InputDef>): Record<string, z.ZodType> {
  const schema: Record<string, z.ZodType> = {};
  for (const [name, def] of Object.entries(inputs)) {
    schema[name] = inputTypeToZod(def.type, def.required ?? false).describe(def.description);
  }
  return schema;
}

// ============================================================================
// Tool Handlers
// ============================================================================

type ToolHandler = (
  args: Record<string, unknown>, 
  template: Template, 
  context: { 
    filePath: string; 
    save: () => void;
  }
) => unknown;

const toolHandlers: Record<string, ToolHandler> = {
  // Template Tools
  get_template_info: (args, template) => {
    const defaultRuleSet = template.ruleSets?.[0];
    return {
      name: template.name,
      fileName: template.fileName,
      version: template.version,
      description: template.description,
      owner: template.owner,
      application: template.application,
      docs: template.docs,
      command: template.command,
      fieldCount: template.fields.length,
      ruleSetCount: template.ruleSets?.length ?? 0,
      ruleCount: defaultRuleSet?.rules?.length ?? 0,
      ruleSets: template.ruleSets?.map((rs, i) => ({
        index: i,
        name: rs.name,
        description: rs.description,
        tags: rs.tags,
        extends: rs.extends,
        ruleCount: rs.rules?.length ?? 0,
      })),
    };
  },

  // create_template is handled specially in registerAllTools - see below

  // Documentation Fetch Tools
  fetch_template_docs: async (args, template) => {
    const docsUrl = template.docs;
    
    if (!docsUrl) {
      return {
        success: false,
        error: 'This template does not have a documentation URL configured. The "docs" field is not set in the template metadata.',
      };
    }
    
    try {
      const response = await fetch(docsUrl);
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch documentation: HTTP ${response.status} ${response.statusText}`,
          url: docsUrl,
        };
      }
      
      const content = await response.text();
      return {
        success: true,
        url: docsUrl,
        content: content.substring(0, 50000), // Limit to 50KB to avoid overwhelming the context
        truncated: content.length > 50000,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch documentation: ${error instanceof Error ? error.message : String(error)}`,
        url: docsUrl,
      };
    }
  },

  fetch_field_docs: async (args, template) => {
    const name = args.name as string;
    const field = findField(template, name);
    
    if (!field) {
      return {
        success: false,
        error: `Field "${name}" not found in the template.`,
      };
    }
    
    if (!field.link) {
      return {
        success: false,
        error: `Field "${name}" does not have a documentation link configured.`,
        field: {
          name: field.name,
          info: field.info,
          example: field.example,
        },
      };
    }
    
    try {
      const response = await fetch(field.link);
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch documentation: HTTP ${response.status} ${response.statusText}`,
          url: field.link,
          field: {
            name: field.name,
            info: field.info,
          },
        };
      }
      
      const content = await response.text();
      return {
        success: true,
        fieldName: name,
        url: field.link,
        content: content.substring(0, 50000), // Limit to 50KB
        truncated: content.length > 50000,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch documentation: ${error instanceof Error ? error.message : String(error)}`,
        url: field.link,
        field: {
          name: field.name,
          info: field.info,
        },
      };
    }
  },

  // Field Tools
  list_fields: (args, template) => {
    let fields = template.fields;
    const filter = args.filter as string | undefined;
    const onlyChecked = args.onlyChecked as boolean | undefined;
    const limit = args.limit as number | undefined;

    if (filter) {
      fields = fields.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
    }
    if (onlyChecked) {
      fields = fields.filter(f => f.checked === true);
    }
    if (limit && limit > 0) {
      fields = fields.slice(0, limit);
    }

    return fields.map(f => ({
      name: f.name,
      value: f.value,
      checked: f.checked ?? false,
      info: f.info,
      range: f.range,
    }));
  },

  get_field: (args, template) => {
    const name = args.name as string;
    const field = findField(template, name);
    
    if (!field) {
      throw new Error(`Field "${name}" not found`);
    }

    return {
      ...field,
      isRequired: isFieldRequiredInTemplate(template, name),
      affectedFields: getAffectedFields(template, name),
    };
  },

  set_field: (args, template, ctx) => {
    const name = args.name as string;
    const value = args.value as Field['value'] | undefined;
    const checked = args.checked as boolean | undefined;
    const example = args.example as string | undefined;
    const info = args.info as string | undefined;
    const range = args.range as string | undefined;
    const link = args.link as string | undefined;

    const fieldIndex = findFieldIndex(template, name);
    if (fieldIndex === -1) {
      throw new Error(`Field "${name}" not found`);
    }

    if (value !== undefined) {
      template.fields[fieldIndex].value = value;
    }
    if (checked !== undefined) {
      template.fields[fieldIndex].checked = checked;
    }
    if (example !== undefined) {
      template.fields[fieldIndex].example = example;
    }
    if (info !== undefined) {
      template.fields[fieldIndex].info = info;
    }
    if (range !== undefined) {
      template.fields[fieldIndex].range = range;
    }
    if (link !== undefined) {
      template.fields[fieldIndex].link = link;
    }

    const { updatedFields, appliedRules } = applyRulesToFields(template.fields, getDefaultRules(template, true));
    template.fields = updatedFields;
    ctx.save();

    return {
      success: true,
      field: {
        name: template.fields[fieldIndex].name,
        value: template.fields[fieldIndex].value,
        checked: template.fields[fieldIndex].checked,
      },
      appliedRules,
    };
  },

  set_fields: (args, template, ctx) => {
    const updates = args.updates as Array<{ name: string; value?: Field['value']; checked?: boolean }>;
    const results: { name: string; updated: boolean; error?: string }[] = [];

    for (const update of updates) {
      const fieldIndex = findFieldIndex(template, update.name);
      if (fieldIndex === -1) {
        results.push({ name: update.name, updated: false, error: 'Field not found' });
        continue;
      }

      if (update.value !== undefined) {
        template.fields[fieldIndex].value = update.value;
      }
      if (update.checked !== undefined) {
        template.fields[fieldIndex].checked = update.checked;
      }
      results.push({ name: update.name, updated: true });
    }

    const { updatedFields, appliedRules } = applyRulesToFields(template.fields, getDefaultRules(template, true));
    template.fields = updatedFields;
    ctx.save();

    return { success: true, results, appliedRules };
  },

  add_field: (args, template, ctx) => {
    const field = args.field as Field;
    const insertAfter = args.insertAfter as string | undefined;

    if (findField(template, field.name)) {
      throw new Error(`Field "${field.name}" already exists`);
    }

    if (insertAfter) {
      const index = findFieldIndex(template, insertAfter);
      if (index === -1) {
        throw new Error(`Insert after field "${insertAfter}" not found`);
      }
      template.fields.splice(index + 1, 0, field);
    } else {
      template.fields.push(field);
    }

    ctx.save();
    return { success: true, field, totalFields: template.fields.length };
  },

  delete_field: (args, template, ctx) => {
    const name = args.name as string;
    const deleteRelatedRules = args.deleteRelatedRules as boolean | undefined;

    const fieldIndex = findFieldIndex(template, name);
    if (fieldIndex === -1) {
      throw new Error(`Field "${name}" not found`);
    }

    template.fields.splice(fieldIndex, 1);

    let deletedRules = 0;
    if (deleteRelatedRules && template.ruleSets?.[0]) {
      const rules = template.ruleSets[0].rules;
      const originalLength = rules.length;
      template.ruleSets[0].rules = rules.filter((rule: Rule) => {
        const hasCondition = rule.conditions?.some((c: RuleDomain) => c.name === name);
        const hasTarget = rule.targets.some((t: RuleDomain) => t.name === name);
        return !hasCondition && !hasTarget;
      });
      deletedRules = originalLength - template.ruleSets[0].rules.length;
    }

    ctx.save();
    return { success: true, deletedField: name, deletedRules };
  },

  // Rule Tools
  list_rules: (args, template) => {
    const ruleSetIndex = (args.ruleSetIndex as number | undefined) ?? 0;
    const filter = args.filter as string | undefined;
    const includeInherited = (args.includeInherited as boolean | undefined) ?? false;
    
    const ruleSet = template.ruleSets?.[ruleSetIndex];
    if (!ruleSet) {
      throw new Error(`RuleSet at index ${ruleSetIndex} not found`);
    }

    // Get rules - either just this ruleset's rules or include inherited
    const allRules = includeInherited 
      ? resolveRuleSetRules(template, ruleSetIndex)
      : ruleSet.rules;
    
    // Track where inherited rules come from
    const inheritanceChain = includeInherited && ruleSet.extends
      ? getRuleSetInheritanceChain(template, ruleSetIndex)
      : undefined;
    
    // Count own rules vs inherited
    const ownRuleCount = ruleSet.rules.length;
    const inheritedRuleCount = allRules.length - ownRuleCount;

    let rules = allRules.map((rule: Rule, index: number) => ({
      ruleNumber: index + 1, // 1-based for consistency with validation messages
      description: rule.description,
      humanReadable: translateRule(rule),
      conditionCount: rule.conditions?.length ?? 0,
      targetCount: rule.targets.length,
      inherited: includeInherited && index < inheritedRuleCount,
    }));

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      rules = rules.filter((r) => {
        const originalRule = allRules[r.ruleNumber - 1];
        const inConditions = originalRule.conditions?.some((c: RuleDomain) => 
          c.name.toLowerCase().includes(lowerFilter)
        );
        const inTargets = originalRule.targets.some((t: RuleDomain) => 
          t.name.toLowerCase().includes(lowerFilter)
        );
        return inConditions || inTargets;
      });
    }

    return { 
      ruleSet: ruleSet.name, 
      extends: ruleSet.extends,
      inheritanceChain,
      ownRuleCount,
      inheritedRuleCount: includeInherited ? inheritedRuleCount : undefined,
      rules,
    };
  },

  get_rule: (args, template) => {
    const ruleSetIndex = (args.ruleSetIndex as number | undefined) ?? 0;
    const ruleNumber = args.ruleNumber as number;
    const index = ruleNumber - 1; // Convert 1-based ruleNumber to 0-based index

    const ruleSet = template.ruleSets?.[ruleSetIndex];
    if (!ruleSet) {
      throw new Error(`RuleSet at index ${ruleSetIndex} not found`);
    }

    if (index < 0 || index >= ruleSet.rules.length) {
      throw new Error(`Rule ${ruleNumber} not found (valid range: 1-${ruleSet.rules.length})`);
    }

    const rule = ruleSet.rules[index];

    return {
      ruleNumber,
      ...rule,
      humanReadable: translateRule(rule),
    };
  },

  add_rule: (args, template, ctx) => {
    const ruleSetIndex = (args.ruleSetIndex as number | undefined) ?? 0;
    const conditions = args.conditions as RuleDomain[] | undefined;
    const targets = args.targets as RuleDomain[];
    const description = args.description as string | undefined;
    const validate = (args.validate as boolean | undefined) ?? true;

    const ruleSet = template.ruleSets?.[ruleSetIndex];
    if (!ruleSet) {
      throw new Error(`RuleSet at index ${ruleSetIndex} not found`);
    }

    const newRule: Rule = { conditions, targets, description };
    ruleSet.rules.push(newRule);

    if (validate) {
      const validation = validateRules(ruleSet.rules);
      if (!validation.isValid) {
        ruleSet.rules.pop(); // Rollback
        throw new Error(`Rule validation failed: ${validation.errors.join(', ')}`);
      }
    }

    ctx.save();
    return { 
      success: true, 
      ruleNumber: ruleSet.rules.length, // 1-based
      rule: newRule,
      humanReadable: translateRule(newRule),
    };
  },

  update_rule: (args, template, ctx) => {
    const ruleSetIndex = (args.ruleSetIndex as number | undefined) ?? 0;
    const ruleNumber = args.ruleNumber as number;
    const index = ruleNumber - 1; // Convert 1-based ruleNumber to 0-based index
    const conditions = args.conditions as RuleDomain[] | undefined;
    const targets = args.targets as RuleDomain[] | undefined;
    const description = args.description as string | undefined;
    const validate = (args.validate as boolean | undefined) ?? true;

    const ruleSet = template.ruleSets?.[ruleSetIndex];
    if (!ruleSet) {
      throw new Error(`RuleSet at index ${ruleSetIndex} not found`);
    }

    if (index < 0 || index >= ruleSet.rules.length) {
      throw new Error(`Rule ${ruleNumber} not found (valid range: 1-${ruleSet.rules.length})`);
    }

    const rule = ruleSet.rules[index];

    const backup = { ...rule };
    if (conditions !== undefined) rule.conditions = conditions;
    if (targets !== undefined) rule.targets = targets;
    if (description !== undefined) rule.description = description;

    if (validate) {
      const validation = validateRules(ruleSet.rules);
      if (!validation.isValid) {
        Object.assign(rule, backup); // Rollback
        throw new Error(`Rule validation failed: ${validation.errors.join(', ')}`);
      }
    }

    ctx.save();
    return { 
      success: true, 
      ruleNumber,
      rule,
      humanReadable: translateRule(rule),
    };
  },

  delete_rule: (args, template, ctx) => {
    const ruleSetIndex = (args.ruleSetIndex as number | undefined) ?? 0;
    const ruleNumber = args.ruleNumber as number;
    const index = ruleNumber - 1; // Convert 1-based ruleNumber to 0-based index

    const ruleSet = template.ruleSets?.[ruleSetIndex];
    if (!ruleSet) {
      throw new Error(`RuleSet at index ${ruleSetIndex} not found`);
    }

    if (index < 0 || index >= ruleSet.rules.length) {
      throw new Error(`Rule ${ruleNumber} not found (valid range: 1-${ruleSet.rules.length})`);
    }

    const deleted = ruleSet.rules.splice(index, 1)[0];
    ctx.save();

    return { success: true, deletedRuleNumber: ruleNumber, deletedRule: deleted };
  },

  merge_rules: (args, template, ctx) => {
    const ruleSetIndex = (args.ruleSetIndex as number | undefined) ?? 0;
    const ruleNumbers = args.ruleNumbers as number[];
    const newDescription = args.newDescription as string | undefined;

    // Validate input
    if (!ruleNumbers || ruleNumbers.length < 2) {
      throw new Error('At least 2 rule numbers are required to merge');
    }

    const ruleSet = template.ruleSets?.[ruleSetIndex];
    if (!ruleSet) {
      throw new Error(`RuleSet at index ${ruleSetIndex} not found`);
    }

    // Convert to 0-based indices and validate
    const indices = ruleNumbers.map(n => n - 1);
    for (const idx of indices) {
      if (idx < 0 || idx >= ruleSet.rules.length) {
        throw new Error(`Rule ${idx + 1} not found (valid range: 1-${ruleSet.rules.length})`);
      }
    }

    // Get the rules to merge
    const rulesToMerge = indices.map(idx => ruleSet.rules[idx]);

    // Check that all rules have identical conditions (using the same logic as validator)
    const conditionKeys = rulesToMerge.map(rule => 
      JSON.stringify((rule.conditions ?? []).map((c: RuleDomain) => ({
        name: c.name,
        state: c.state,
        not: c.not,
        value: c.value,
      })))
    );

    const uniqueConditionKeys = new Set(conditionKeys);
    if (uniqueConditionKeys.size > 1) {
      throw new Error(
        'Cannot merge rules with different conditions. Only rules with identical conditions can be merged. ' +
        'Use validate_rules to find which rules are safe to merge.'
      );
    }

    // Check for target conflicts before merging
    const targetMap = new Map<string, { state: RuleState; not?: boolean; value?: string }>();
    for (const rule of rulesToMerge) {
      for (const target of rule.targets) {
        const existing = targetMap.get(target.name);
        if (existing) {
          // Check for conflicts
          if (existing.state !== target.state) {
            throw new Error(
              `Cannot merge: conflicting states for target "${target.name}" ` +
              `(${existing.state} vs ${target.state})`
            );
          }
          if (existing.not !== target.not) {
            throw new Error(
              `Cannot merge: conflicting not-flags for target "${target.name}"`
            );
          }
          if (existing.value !== target.value) {
            throw new Error(
              `Cannot merge: conflicting values for target "${target.name}" ` +
              `("${existing.value}" vs "${target.value}")`
            );
          }
          // Same target with same state/not/value - OK to skip duplicate
        } else {
          targetMap.set(target.name, { 
            state: target.state, 
            not: target.not, 
            value: target.value 
          });
        }
      }
    }

    // Build merged targets (deduplicated)
    const mergedTargets: RuleDomain[] = [];
    for (const [name, props] of targetMap.entries()) {
      mergedTargets.push({
        name,
        state: props.state,
        ...(props.not !== undefined && { not: props.not }),
        ...(props.value !== undefined && { value: props.value }),
      });
    }

    // Build merged description
    const descriptions = rulesToMerge
      .map(r => r.description)
      .filter((d): d is string => !!d);
    const mergedDescription = newDescription ?? 
      (descriptions.length > 0 ? descriptions.join(' + ') : undefined);

    // Create merged rule
    const mergedRule: Rule = {
      conditions: rulesToMerge[0].conditions,
      targets: mergedTargets,
      ...(mergedDescription && { description: mergedDescription }),
    };

    // Remove old rules (in reverse order to preserve indices)
    const sortedIndices = [...indices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      ruleSet.rules.splice(idx, 1);
    }

    // Add merged rule at the position of the first original rule
    const insertPosition = Math.min(...indices);
    ruleSet.rules.splice(insertPosition, 0, mergedRule);

    ctx.save();

    return {
      success: true,
      mergedRuleNumber: insertPosition + 1,
      mergedRule,
      humanReadable: translateRule(mergedRule),
      removedRuleNumbers: ruleNumbers,
      message: `Merged ${ruleNumbers.length} rules into rule ${insertPosition + 1}`,
    };
  },

  // RuleSet Management Tools
  list_rulesets: (args, template) => {
    const ruleSets = template.ruleSets ?? [];
    return {
      count: ruleSets.length,
      ruleSets: ruleSets.map((rs, index) => ({
        index,
        name: rs.name,
        description: rs.description,
        tags: rs.tags ?? [],
        extends: rs.extends,
        ruleCount: rs.rules?.length ?? 0,
      })),
    };
  },

  add_ruleset: (args, template, ctx) => {
    const name = args.name as string;
    const description = (args.description as string) ?? '';
    const tags = (args.tags as string[]) ?? [];
    const extendsName = args.extends as string | undefined;

    // Check for duplicate name
    if (template.ruleSets?.some(rs => rs.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`RuleSet with name "${name}" already exists`);
    }

    // Validate extends reference if provided
    if (extendsName) {
      const parentRuleSet = template.ruleSets?.find(rs => rs.name === extendsName);
      if (!parentRuleSet) {
        const available = template.ruleSets?.map(rs => rs.name).join(', ') || 'none';
        throw new Error(`Cannot extend ruleset "${extendsName}": not found. Available rulesets: ${available}`);
      }
    }

    const newRuleSet: RuleSet = {
      name,
      description,
      tags,
      rules: [],
      ...(extendsName && { extends: extendsName }),
    };

    if (!template.ruleSets) {
      template.ruleSets = [];
    }
    template.ruleSets.push(newRuleSet);
    ctx.save();

    return {
      success: true,
      index: template.ruleSets.length - 1,
      ruleSet: newRuleSet,
    };
  },

  update_ruleset: (args, template, ctx) => {
    const index = args.index as number;
    const name = args.name as string | undefined;
    const description = args.description as string | undefined;
    const tags = args.tags as string[] | undefined;
    const extendsName = args.extends as string | undefined;

    if (!template.ruleSets || index < 0 || index >= template.ruleSets.length) {
      throw new Error(`RuleSet at index ${index} not found`);
    }

    const ruleSet = template.ruleSets[index];

    // Check for duplicate name (if changing name)
    if (name !== undefined && name !== ruleSet.name) {
      if (template.ruleSets.some(rs => rs.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`RuleSet with name "${name}" already exists`);
      }
      ruleSet.name = name;
    }

    if (description !== undefined) {
      ruleSet.description = description;
    }
    if (tags !== undefined) {
      ruleSet.tags = tags;
    }
    if (extendsName !== undefined) {
      if (extendsName === '') {
        // Empty string removes the extends
        delete ruleSet.extends;
      } else {
        // Validate extends reference
        const parentRuleSet = template.ruleSets.find(rs => rs.name === extendsName);
        if (!parentRuleSet) {
          const available = template.ruleSets.map(rs => rs.name).join(', ');
          throw new Error(`Cannot extend ruleset "${extendsName}": not found. Available rulesets: ${available}`);
        }
        // Prevent self-reference
        if (extendsName === ruleSet.name) {
          throw new Error(`RuleSet cannot extend itself`);
        }
        // Prevent circular inheritance
        const visited = new Set<string>([ruleSet.name]);
        let current = extendsName;
        while (current) {
          if (visited.has(current)) {
            throw new Error(`Circular inheritance detected: ${[...visited, current].join(' -> ')}`);
          }
          visited.add(current);
          const parent = template.ruleSets.find(rs => rs.name === current);
          current = parent?.extends || '';
        }
        ruleSet.extends = extendsName;
      }
    }

    ctx.save();
    return {
      success: true,
      index,
      ruleSet: {
        name: ruleSet.name,
        description: ruleSet.description,
        tags: ruleSet.tags,
        extends: ruleSet.extends,
        ruleCount: ruleSet.rules?.length ?? 0,
      },
    };
  },

  delete_ruleset: (args, template, ctx) => {
    const index = args.index as number;

    if (!template.ruleSets || index < 0 || index >= template.ruleSets.length) {
      throw new Error(`RuleSet at index ${index} not found`);
    }

    // Don't allow deleting the last ruleset
    if (template.ruleSets.length === 1) {
      throw new Error('Cannot delete the last ruleset. A template must have at least one ruleset.');
    }

    const deleted = template.ruleSets.splice(index, 1)[0];
    ctx.save();

    return {
      success: true,
      deletedRuleSet: {
        name: deleted.name,
        description: deleted.description,
        ruleCount: deleted.rules?.length ?? 0,
      },
    };
  },

  // Validation Tools
  validate_rules: (args, template) => {
    const ruleSetIndex = args.ruleSetIndex as number | undefined;
    
    // First check for inheritance issues
    const inheritanceValidation = validateRuleSetInheritance(template);
    
    if (ruleSetIndex !== undefined) {
      const ruleSet = template.ruleSets?.[ruleSetIndex];
      if (!ruleSet) {
        throw new Error(`RuleSet at index ${ruleSetIndex} not found`);
      }
      // Validate with inherited rules included
      const allRules = resolveRuleSetRules(template, ruleSetIndex);
      const validation = validateRules(allRules);
      return {
        ...validation,
        ruleSet: ruleSet.name,
        extends: ruleSet.extends,
        ownRuleCount: ruleSet.rules?.length ?? 0,
        totalRuleCount: allRules.length,
        inheritanceErrors: inheritanceValidation.errors.filter(e => e.includes(ruleSet.name)),
      };
    }

    // Validate all rulesets with resolved (inherited) rules
    const results = template.ruleSets?.map((ruleSet, i) => {
      const allRules = resolveRuleSetRules(template, i);
      return {
        ruleSet: ruleSet.name,
        index: i,
        extends: ruleSet.extends,
        ownRuleCount: ruleSet.rules?.length ?? 0,
        totalRuleCount: allRules.length,
        ...validateRules(allRules),
      };
    });

    return {
      isValid: (results?.every(r => r.isValid) ?? true) && inheritanceValidation.isValid,
      inheritanceErrors: inheritanceValidation.errors,
      results,
    };
  },

  validate_fields: (args, template) => {
    const onlyChecked = args.onlyChecked as boolean | undefined;
    
    let fields = template.fields;
    if (onlyChecked) {
      fields = fields.filter(f => f.checked === true);
    }

    const results = fields.map(field => {
      const isValid = validateValue(field.value, field.range);
      return {
        name: field.name,
        valid: isValid,
        value: field.value,
        range: field.range,
      };
    });

    return {
      valid: results.every(r => r.valid),
      invalidFields: results.filter(r => !r.valid),
      totalChecked: fields.length,
    };
  },

  validate_field: (args, template) => {
    const name = args.name as string;
    const providedValue = args.value as Field['value'] | undefined;

    const field = findField(template, name);
    if (!field) {
      throw new Error(`Field "${name}" not found`);
    }

    const valueToValidate = providedValue !== undefined ? providedValue : field.value;
    const isValid = validateValue(valueToValidate, field.range);

    return {
      name: field.name,
      valid: isValid,
      value: valueToValidate,
      range: field.range,
      currentValue: field.value,
      checked: field.checked ?? false,
    };
  },

  validate_template: (args, template) => {
    const issues: { type: 'error' | 'warning'; message: string }[] = [];

    // Check metadata
    if (!template.name) issues.push({ type: 'error', message: 'Missing template name' });
    if (!template.fileName) issues.push({ type: 'warning', message: 'Missing fileName' });
    if (!template.version) issues.push({ type: 'warning', message: 'Missing version' });

    // Check fields
    if (!template.fields || template.fields.length === 0) {
      issues.push({ type: 'warning', message: 'No fields defined' });
    } else {
      const fieldNames = new Set<string>();
      for (const field of template.fields) {
        if (!field.name) {
          issues.push({ type: 'error', message: 'Field with missing name' });
        } else if (fieldNames.has(field.name)) {
          issues.push({ type: 'error', message: `Duplicate field name: ${field.name}` });
        } else {
          fieldNames.add(field.name);
        }

        if (!field.info) {
          issues.push({ type: 'warning', message: `Field "${field.name}" missing info` });
        }
        if (!field.range) {
          issues.push({ type: 'warning', message: `Field "${field.name}" missing range` });
        }

        // Validate value against range
        if (field.range && !validateValue(field.value, field.range)) {
          issues.push({ type: 'error', message: `Field "${field.name}" value doesn't match range "${field.range}"` });
        }
      }
    }

    // Validate ruleset inheritance (check for circular extends)
    const inheritanceValidation = validateRuleSetInheritance(template);
    for (const error of inheritanceValidation.errors) {
      issues.push({ type: 'error', message: error });
    }

    // Validate rules - use resolved rules (including inherited) for each ruleset
    const ruleSetResults = template.ruleSets?.map((ruleSet, i) => {
      // Get all rules including inherited ones
      const allRules = resolveRuleSetRules(template, i);
      const validation = validateRules(allRules);
      return {
        index: i,
        name: ruleSet.name,
        extends: ruleSet.extends,
        ownRuleCount: ruleSet.rules?.length ?? 0,
        totalRuleCount: allRules.length,
        ...validation,
      };
    }) ?? [];

    for (const result of ruleSetResults) {
      for (const error of result.errors) {
        issues.push({ type: 'error', message: `RuleSet "${result.name}": ${error}` });
      }
      for (const warning of result.warnings) {
        issues.push({ type: 'warning', message: `RuleSet "${result.name}": ${warning}` });
      }
    }

    const errors = issues.filter(i => i.type === 'error');
    const warnings = issues.filter(i => i.type === 'warning');

    return {
      valid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors: errors.map(e => e.message),
      warnings: warnings.map(w => w.message),
      summary: {
        name: template.name,
        version: template.version,
        fieldCount: template.fields?.length ?? 0,
        ruleSetCount: template.ruleSets?.length ?? 0,
        checkedFields: template.fields?.filter(f => f.checked).length ?? 0,
      },
      ruleSetDetails: ruleSetResults.map(r => ({
        name: r.name,
        extends: r.extends,
        ownRules: r.ownRuleCount,
        totalRules: r.totalRuleCount,
        isValid: r.isValid,
      })),
    };
  },

  validate_settings: (args, template) => {
    const settingsPath = args.settingsPath as string;
    const rulesetName = args.rulesetName as string | undefined;
    const rulesetTag = args.rulesetTag as string | undefined;
    const strict = (args.strict as boolean | undefined) ?? false;

    // Load settings file
    const absolutePath = path.resolve(settingsPath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Settings file not found: ${absolutePath}`);
    }
    
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const ext = path.extname(settingsPath).toLowerCase();
    
    let settings: Record<string, FieldValue>;
    if (ext === '.json') {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const flattened = flattenObject(parsed);
      settings = toFieldValues(flattened);
    } else if (ext === '.yaml' || ext === '.yml') {
      const parsed = yaml.load(content) as Record<string, unknown>;
      const flattened = flattenObject(parsed);
      settings = toFieldValues(flattened);
    } else if (ext === '.properties' || ext === '.env' || ext === '.txt') {
      const parsed = parseKeyValueFormat(content);
      settings = toFieldValues(parsed);
    } else {
      throw new Error(`Unsupported settings format: ${ext}. Supported: .json, .yaml, .yml, .properties, .env`);
    }

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

  // Note: export_config is in import-export-tools.ts with multi-format support
};

// ============================================================================
// Dynamic Tool Registration
// ============================================================================

export function registerAllTools(context: ToolContext): void {
  const { server, getTemplatePath } = context;

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
        const filePath = args.filePath as string;
        const resolvedPath = path.resolve(filePath);
        const setAsActive = (args.setAsActive as boolean) ?? true;
        
        // Check if file already exists
        if (fs.existsSync(resolvedPath)) {
          throw new Error(`Template file already exists: ${resolvedPath}. Use set_template to switch to it, or other tools to modify it.`);
        }
        
        // Create new template
        const template: Template = {
          name: args.name as string,
          fileName: path.basename(resolvedPath),
          version: (args.version as string) || '1.0.0',
          description: (args.description as string) || '',
          owner: (args.owner as string) || '',
          application: (args.application as string) || undefined,
          fields: [],
          ruleSets: [{
            name: 'Default',
            description: 'Default ruleset',
            tags: [],
            rules: [],
          }],
        };
        
        // Ensure directory exists
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Save template
        saveTemplate(resolvedPath, template);
        
        // Set as active template if requested
        if (setAsActive && context.setTemplatePath) {
          context.setTemplatePath(resolvedPath);
        }
        
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
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
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: (error as Error).message }],
          isError: true,
        };
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
        const filePath = args.filePath as string;
        const resolvedPath = path.resolve(filePath);
        
        // Verify file exists and is valid
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`Template file not found: ${resolvedPath}`);
        }
        
        // Try to load it to validate it's a proper template
        const template = loadTemplate(resolvedPath);
        
        // Set as active template
        if (context.setTemplatePath) {
          context.setTemplatePath(resolvedPath);
        }
        
        const previousPath = context.getCurrentTemplatePath?.();
        
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
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
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: (error as Error).message }],
          isError: true,
        };
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
        const targetPath = getTemplatePath(args.filePath as string | undefined);
        const sourcePath = path.resolve(args.sourceTemplatePath as string);
        
        // Verify source file exists
        if (!fs.existsSync(sourcePath)) {
          throw new Error(`Source template file not found: ${sourcePath}`);
        }
        
        // Load both templates
        const targetTemplate = loadTemplate(targetPath);
        const sourceTemplate = loadTemplate(sourcePath);
        
        // Merge templates
        const mergedTemplate = mergeTemplates(targetTemplate, sourceTemplate);
        
        // Save merged template
        saveTemplate(targetPath, mergedTemplate);
        
        // Calculate stats
        const newFields = mergedTemplate.fields.length - targetTemplate.fields.length;
        const newRules = (mergedTemplate.ruleSets?.[0]?.rules?.length ?? 0) - (targetTemplate.ruleSets?.[0]?.rules?.length ?? 0);
        
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
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
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: (error as Error).message }],
          isError: true,
        };
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
          const filePath = args.filePath as string | undefined;
          const resolvedPath = getTemplatePath(filePath);
          const template = loadTemplate(resolvedPath);
          
          const ctx = {
            filePath: resolvedPath,
            save: () => saveTemplate(resolvedPath, template),
          };

          const result = handler(args, template, ctx);
          
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text' as const, text: (error as Error).message }],
            isError: true,
          };
        }
      }
    );
  }

  console.error(`Registered ${toolDefinitions.length} tools dynamically`);
}
