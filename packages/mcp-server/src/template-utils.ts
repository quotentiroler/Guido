/**
 * Template utilities for loading, saving, and manipulating guido templates
 * 
 * This module provides MCP-specific utilities:
 * - File I/O operations (loadTemplate, saveTemplate)
 * - Template migration (legacy rules array → ruleSets)
 * - Change tracking for sessions
 * - Field/rule helpers that operate on Template objects
 * 
 * For core logic, import directly from @guido/core.
 * For types, import directly from @guido/types.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Template, Field, Rule, RuleDomain } from '@guido/types';
import { applyRules, isFieldRequired, getDefaultRules } from '@guido/core';

// ============================================================================
// BACKWARDS COMPATIBILITY HELPER
// ============================================================================

/**
 * Migrate legacy template with `rules` array to new `ruleSets` format.
 * If template already has ruleSets, returns as-is.
 * If template has legacy rules array, migrates to ruleSets.
 */
export function migrateTemplate(template: Template & { rules?: Rule[] }): Template {
  // Already has ruleSets - no migration needed
  if (template.ruleSets && template.ruleSets.length > 0) {
    return template;
  }
  
  // Has legacy rules array - migrate it
  const legacyRules = (template as { rules?: Rule[] }).rules;
  if (legacyRules && legacyRules.length > 0) {
    const migrated: Template = {
      ...template,
      ruleSets: [{
        name: 'Default',
        description: 'Migrated from legacy rules array',
        tags: [],
        rules: legacyRules,
      }],
    };
    // Remove legacy rules property
    delete (migrated as { rules?: Rule[] }).rules;
    return migrated;
  }
  
  // No rules at all - create empty default ruleset
  return {
    ...template,
    ruleSets: [{
      name: 'Default',
      description: 'Default rule set',
      tags: [],
      rules: [],
    }],
  };
}

// ============================================================================
// CHANGE TRACKING
// ============================================================================

interface ChangeEntry {
  timestamp: string;
  type: 'field_update' | 'field_add' | 'field_delete' | 'rule_add' | 'rule_update' | 'rule_delete' | 'import' | 'export';
  details: Record<string, unknown>;
}

interface TemplateSnapshot {
  loadedAt: string;
  template: Template;
}

// In-memory change tracking per template path
const changeLog = new Map<string, ChangeEntry[]>();
const snapshots = new Map<string, TemplateSnapshot>();

/**
 * Record a change for a template
 */
export function recordChange(
  filePath: string,
  type: ChangeEntry['type'],
  details: Record<string, unknown>
): void {
  const absolutePath = path.resolve(filePath);
  if (!changeLog.has(absolutePath)) {
    changeLog.set(absolutePath, []);
  }
  changeLog.get(absolutePath)!.push({
    timestamp: new Date().toISOString(),
    type,
    details,
  });
}

/**
 * Get all changes since last load for a template
 */
export function getChanges(filePath: string): ChangeEntry[] {
  const absolutePath = path.resolve(filePath);
  return changeLog.get(absolutePath) || [];
}

/**
 * Clear change log for a template
 */
export function clearChanges(filePath: string): void {
  const absolutePath = path.resolve(filePath);
  changeLog.delete(absolutePath);
}

/**
 * Get the initial snapshot of a template (when first loaded)
 */
export function getSnapshot(filePath: string): TemplateSnapshot | undefined {
  const absolutePath = path.resolve(filePath);
  return snapshots.get(absolutePath);
}

/**
 * Load a guido template from a file path
 * Automatically migrates legacy templates with `rules` array to `ruleSets` format
 */
export function loadTemplate(filePath: string): Template {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Template file not found: ${absolutePath}`);
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const rawTemplate = JSON.parse(content) as Template & { rules?: Rule[] };
  
  // Migrate legacy format if needed
  const template = migrateTemplate(rawTemplate);
  
  // Store snapshot if first load
  if (!snapshots.has(absolutePath)) {
    snapshots.set(absolutePath, {
      loadedAt: new Date().toISOString(),
      template: JSON.parse(JSON.stringify(template)) as Template, // Deep copy
    });
  }
  
  return template;
}

/**
 * Save a guido template to a file path
 */
export function saveTemplate(filePath: string, template: Template): void {
  const absolutePath = path.resolve(filePath);
  fs.writeFileSync(absolutePath, JSON.stringify(template, null, 2), 'utf-8');
}

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
