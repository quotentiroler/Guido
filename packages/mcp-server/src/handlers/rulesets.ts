import type { RuleSet } from '@quotentiroler/guido-types';
import type { ToolHandler } from './types.js';
import { optString, optStrings, reqNumber, reqString } from './args.js';

export const ruleSetHandlers: Record<string, ToolHandler> = {
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
    const name = reqString(args, 'name');
    const description = optString(args, 'description') ?? '';
    const tags = optStrings(args, 'tags') ?? [];
    const extendsName = optString(args, 'extends');

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
    const index = reqNumber(args, 'index');
    const name = optString(args, 'name');
    const description = optString(args, 'description');
    const tags = optStrings(args, 'tags');
    const extendsName = optString(args, 'extends');

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
    const index = reqNumber(args, 'index');

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
};
