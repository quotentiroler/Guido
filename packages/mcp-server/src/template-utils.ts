/**
 * Template helpers that operate on Template objects in memory.
 *
 * Storage lives behind the TemplateStore port in ./store, so these stay pure and
 * work the same on the filesystem and in a hosted server.
 *
 * For core logic, import directly from @quotentiroler/guido-core.
 * For types, import directly from @quotentiroler/guido-types.
 */
import type { Template, Field, Rule, RuleDomain } from '@quotentiroler/guido-types';
import { applyRules, isFieldRequired, getDefaultRules } from '@quotentiroler/guido-core';

/**
 * Find a field by name in the template
 */
export function findField(template: Template, fieldName: string): Field | undefined {
  return template.fields.find((f: Field) => f.name === fieldName);
}

/**
 * Find a field index by name
 */
export function findFieldIndex(template: Template, fieldName: string): number {
  return template.fields.findIndex((f: Field) => f.name === fieldName);
}

/**
 * Apply rules to fields after a change
 * Returns the updated fields and list of applied rule descriptions
 */
export function applyRulesToFields(
  fields: Field[],
  rules: Rule[]
): { updatedFields: Field[]; appliedRules: string[] } {
  const result = applyRules(fields, rules);
  
  // Extract unique applied rules from disabledReasons
  const appliedRules = [...new Set(Object.values(result.disabledReasons))] as string[];
  
  return { 
    updatedFields: result.updatedFields, 
    appliedRules 
  };
}

/**
 * Get fields that would be affected by changing a specific field.
 * Includes inherited rules by default.
 */
export function getAffectedFields(
  template: Template,
  fieldName: string
): string[] {
  const affected = new Set<string>();
  // Use resolved rules to include inherited rules
  const rules = getDefaultRules(template, true);

  for (const rule of rules) {
    const involvesField = rule.conditions?.some((c: RuleDomain) => c.name === fieldName);
    if (involvesField) {
      for (const target of rule.targets) {
        affected.add(target.name);
      }
    }
  }

  return [...affected];
}

/**
 * Check if a field is required (has unconditional rule targeting it).
 * Includes inherited rules by default.
 */
export function isFieldRequiredInTemplate(template: Template, fieldName: string): boolean {
  // Use resolved rules to include inherited rules
  return isFieldRequired(fieldName, getDefaultRules(template, true));
}

/**
 * Generate the contrapositive of a rule
 * If A then B becomes If NOT B then NOT A
 */
export function generateContrapositive(rule: Rule): Rule {
  if (!rule.conditions || rule.conditions.length === 0) {
    throw new Error('Cannot generate contrapositive for a rule without conditions');
  }

  return {
    description: rule.description ? `Contrapositive: ${rule.description}` : undefined,
    conditions: rule.targets.map((target: RuleDomain) => ({
      name: target.name,
      state: target.state,
      value: target.value,
      not: !target.not, // Negate
    })),
    targets: rule.conditions.map((condition: RuleDomain) => ({
      name: condition.name,
      state: condition.state,
      value: condition.value,
      not: !condition.not, // Negate
    })),
  };
}

/**
 * Rename a field across the template (updates rules as well)
 */
export function renameField(
  template: Template,
  oldName: string,
  newName: string
): { updatedRules: number } {
  const fieldIndex = findFieldIndex(template, oldName);
  if (fieldIndex === -1) {
    throw new Error(`Field "${oldName}" not found`);
  }

  if (findField(template, newName)) {
    throw new Error(`Field "${newName}" already exists`);
  }

  // Rename the field
  template.fields[fieldIndex].name = newName;

  // Update all rules in all rulesets that reference this field
  let updatedRules = 0;
  for (const ruleSet of template.ruleSets ?? []) {
    for (const rule of ruleSet.rules ?? []) {
      let ruleUpdated = false;
      
      if (rule.conditions) {
        for (const condition of rule.conditions) {
          if (condition.name === oldName) {
            condition.name = newName;
            ruleUpdated = true;
          }
        }
      }
      
      for (const target of rule.targets) {
        if (target.name === oldName) {
          target.name = newName;
          ruleUpdated = true;
        }
      }
      
      if (ruleUpdated) updatedRules++;
    }
  }

  return { updatedRules };
}

/**
 * Duplicate a field with a new name
 */
export function duplicateField(
  template: Template,
  sourceName: string,
  newName: string
): Field {
  const sourceField = findField(template, sourceName);
  if (!sourceField) {
    throw new Error(`Field "${sourceName}" not found`);
  }

  if (findField(template, newName)) {
    throw new Error(`Field "${newName}" already exists`);
  }

  const newField: Field = {
    ...sourceField,
    name: newName,
    checked: false, // New field starts unchecked
  };

  // Insert after source field
  const sourceIndex = findFieldIndex(template, sourceName);
  template.fields.splice(sourceIndex + 1, 0, newField);

  return newField;
}
