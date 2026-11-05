import type { Rule, RuleDomain, RuleState } from '@quotentiroler/guido-types';
import { getRuleSetInheritanceChain, resolveRuleSetRules, translateRule, validateRules } from '@quotentiroler/guido-core';
import type { ToolHandler } from './types.js';
import { RuleDomainListSchema, optArg, optBoolean, optNumber, optString, reqArg, reqNumber, reqNumbers } from './args.js';

export const ruleHandlers: Record<string, ToolHandler> = {
  list_rules: (args, template) => {
    const ruleSetIndex = optNumber(args, 'ruleSetIndex') ?? 0;
    const filter = optString(args, 'filter');
    const includeInherited = optBoolean(args, 'includeInherited') ?? false;
    
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
    const ruleSetIndex = optNumber(args, 'ruleSetIndex') ?? 0;
    const ruleNumber = reqNumber(args, 'ruleNumber');
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
    const ruleSetIndex = optNumber(args, 'ruleSetIndex') ?? 0;
    const conditions = optArg(args, 'conditions', RuleDomainListSchema);
    const targets = reqArg(args, 'targets', RuleDomainListSchema);
    const description = optString(args, 'description');
    const validate = optBoolean(args, 'validate') ?? true;

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
    const ruleSetIndex = optNumber(args, 'ruleSetIndex') ?? 0;
    const ruleNumber = reqNumber(args, 'ruleNumber');
    const index = ruleNumber - 1; // Convert 1-based ruleNumber to 0-based index
    const conditions = optArg(args, 'conditions', RuleDomainListSchema);
    const targets = optArg(args, 'targets', RuleDomainListSchema);
    const description = optString(args, 'description');
    const validate = optBoolean(args, 'validate') ?? true;

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
    const ruleSetIndex = optNumber(args, 'ruleSetIndex') ?? 0;
    const ruleNumber = reqNumber(args, 'ruleNumber');
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
    const ruleSetIndex = optNumber(args, 'ruleSetIndex') ?? 0;
    const ruleNumbers = reqNumbers(args, 'ruleNumbers');
    const newDescription = optString(args, 'newDescription');

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
};
