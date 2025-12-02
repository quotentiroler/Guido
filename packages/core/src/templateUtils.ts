/**
 * @guido/core - Template Utilities
 * 
 * Pure functions for template manipulation.
 */

import { Template, NestedField, RuleSet } from '@guido/types';
import { hasNestedFields, flattenNestedFields } from './fieldUtils';

/**
 * Default empty ruleset - first ruleset is always the default
 */
export const createDefaultRuleSet = (): RuleSet => ({
  name: 'Default',
  description: 'Default rule set',
  tags: [],
  rules: []
});

/**
 * Merge two templates together.
 * - Fields: incoming fields override existing ones with the same name
 * - RuleSets: combines rules, avoiding duplicates by description
 * - Metadata: incoming values take priority if they exist
 * 
 * @param existing - The existing template to merge into
 * @param incoming - The incoming template with new fields/rules
 * @returns A merged template
 */
export const mergeTemplates = (existing: Template, incoming: Template): Template => {
  // Merge fields: incoming fields override existing ones with same name
  const existingFieldMap = new Map(existing.fields.map(f => [f.name, f]));
  incoming.fields.forEach(f => existingFieldMap.set(f.name, f));
  const mergedFields = Array.from(existingFieldMap.values());

  // Ensure both templates have ruleSets
  const existingRuleSets = existing.ruleSets?.length ? existing.ruleSets : [createDefaultRuleSet()];
  const incomingRuleSets = incoming.ruleSets?.length ? incoming.ruleSets : [createDefaultRuleSet()];

  // Merge ruleSets: combine rules, avoiding duplicates by description
  const mergedRuleSets = existingRuleSets.map((existingRs, index) => {
    const incomingRs = incomingRuleSets[index];
    if (!incomingRs) return existingRs;
    
    const existingRuleDescs = new Set(existingRs.rules.map(r => r.description));
    const newRules = incomingRs.rules.filter(r => !existingRuleDescs.has(r.description));
    
    return {
      ...existingRs,
      rules: [...existingRs.rules, ...newRules]
    };
  });

  // Add any additional ruleSets from incoming that don't exist in existing
  if (incomingRuleSets.length > existingRuleSets.length) {
    mergedRuleSets.push(...incomingRuleSets.slice(existingRuleSets.length));
  }

  return {
    ...existing,
    // Keep existing metadata unless incoming has values
    name: incoming.name || existing.name,
    fileName: incoming.fileName || existing.fileName,
    version: incoming.version || existing.version,
    description: incoming.description || existing.description,
    owner: incoming.owner || existing.owner,
    fields: mergedFields,
    ruleSets: mergedRuleSets
  };
};

/**
 * Normalize a template by flattening any nested fields.
 */
export const normalizeTemplateFields = (template: Template): Template => {
  if (!hasNestedFields(template.fields)) {
    return template;
  }

  return {
    ...template,
    fields: flattenNestedFields(template.fields as NestedField[]),
  };
};
