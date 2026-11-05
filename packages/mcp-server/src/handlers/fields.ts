import type { Rule, RuleDomain } from '@quotentiroler/guido-types';
import { getDefaultRules } from '@quotentiroler/guido-core';
import type { ToolHandler } from './types.js';
import { FieldSchema, FieldUpdateListSchema, FieldValueSchema, optArg, optBoolean, optNumber, optString, reqArg, reqString } from './args.js';
import { applyRulesToFields, findField, findFieldIndex, getAffectedFields, isFieldRequiredInTemplate } from '../template-utils.js';

export const fieldHandlers: Record<string, ToolHandler> = {
  list_fields: (args, template) => {
    let fields = template.fields;
    const filter = optString(args, 'filter');
    const onlyChecked = optBoolean(args, 'onlyChecked');
    const limit = optNumber(args, 'limit');

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
    const name = reqString(args, 'name');
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
    const name = reqString(args, 'name');
    const value = optArg(args, 'value', FieldValueSchema);
    const checked = optBoolean(args, 'checked');
    const example = optString(args, 'example');
    const info = optString(args, 'info');
    const range = optString(args, 'range');
    const link = optString(args, 'link');

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
    const updates = reqArg(args, 'updates', FieldUpdateListSchema);
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
    const field = reqArg(args, 'field', FieldSchema);
    const insertAfter = optString(args, 'insertAfter');

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
    const name = reqString(args, 'name');
    const deleteRelatedRules = optBoolean(args, 'deleteRelatedRules');

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
};
