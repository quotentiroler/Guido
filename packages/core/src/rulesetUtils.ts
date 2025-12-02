/**
 * @guido/core - RuleSet Utilities
 * 
 * Core utilities for working with RuleSets including:
 * - Rule resolution with inheritance
 * - Inheritance chain traversal
 * - Inheritance validation (circular detection, missing parents)
 */

import type { Rule, RuleSet, Template } from '@guido/types';

// ============================================================================
// Rule Resolution (with Inheritance)
// ============================================================================

/**
 * Resolve all rules for a ruleset, including inherited rules from parent rulesets.
 * Handles the `extends` field by recursively collecting rules from parent rulesets.
 * Parent rules come first, then the ruleset's own rules (allowing overrides).
 * 
 * @param template - The template containing all rulesets
 * @param ruleSetNameOrIndex - Name or index of the ruleset to resolve
 * @returns Array of rules including inherited ones
 * @throws Error if circular inheritance is detected
 * 
 * @example
 * ```ts
 * // Get all rules for the first ruleset (including inherited)
 * const allRules = resolveRuleSetRules(template, 0);
 * 
 * // Get all rules for a named ruleset
 * const prodRules = resolveRuleSetRules(template, 'Production');
 * ```
 */
export function resolveRuleSetRules(
  template: Template,
  ruleSetNameOrIndex: string | number
): Rule[] {
  const ruleSets = template.ruleSets ?? [];
  
  // Find the ruleset
  const ruleSet = typeof ruleSetNameOrIndex === 'number'
    ? ruleSets[ruleSetNameOrIndex]
    : ruleSets.find(rs => rs.name === ruleSetNameOrIndex);
  
  if (!ruleSet) {
    return [];
  }
  
  // Track visited rulesets to detect circular inheritance
  const visited = new Set<string>();
  const collectedRules: Rule[] = [];
  
  function collectRules(rs: RuleSet): void {
    if (!rs) return;
    
    // Check for circular inheritance
    if (visited.has(rs.name)) {
      throw new Error(`Circular inheritance detected in ruleset: ${rs.name}`);
    }
    visited.add(rs.name);
    
    // First, collect parent rules (if extends is set)
    if (rs.extends) {
      const parent = ruleSets.find(p => p.name === rs.extends);
      if (parent) {
        collectRules(parent);
      }
    }
    
    // Then add this ruleset's own rules
    if (rs.rules) {
      collectedRules.push(...rs.rules);
    }
  }
  
  collectRules(ruleSet);
  return collectedRules;
}

/**
 * Helper to get rules from the default (first) ruleset.
 * By default, returns only the ruleset's own rules.
 * Set resolveInheritance=true to include inherited rules.
 * 
 * @param template - The template
 * @param resolveInheritance - If true, include inherited rules
 * @returns Array of rules
 */
export function getDefaultRules(template: Template, resolveInheritance = false): Rule[] {
  if (resolveInheritance) {
    return resolveRuleSetRules(template, 0);
  }
  return template.ruleSets?.[0]?.rules ?? [];
}

/**
 * Helper to get a specific ruleset's rules.
 * By default, returns only the ruleset's own rules.
 * Set resolveInheritance=true to include inherited rules.
 * 
 * @param template - The template
 * @param index - Index of the ruleset
 * @param resolveInheritance - If true, include inherited rules
 * @returns Array of rules
 */
export function getRuleSetRules(template: Template, index: number, resolveInheritance = false): Rule[] {
  if (resolveInheritance) {
    return resolveRuleSetRules(template, index);
  }
  return template.ruleSets?.[index]?.rules ?? [];
}

// ============================================================================
// Inheritance Chain
// ============================================================================

/**
 * Get the inheritance chain for a ruleset (for display/debugging).
 * Returns an array of ruleset names in inheritance order (parent first).
 * 
 * @param template - The template containing all rulesets
 * @param ruleSetNameOrIndex - Name or index of the ruleset
 * @returns Array of ruleset names in inheritance order
 * 
 * @example
 * ```ts
 * // For a template where Production extends Base:
 * getRuleSetInheritanceChain(template, 'Production')
 * // Returns: ['Base', 'Production']
 * ```
 */
export function getRuleSetInheritanceChain(
  template: Template,
  ruleSetNameOrIndex: string | number
): string[] {
  const ruleSets = template.ruleSets ?? [];
  
  const ruleSet = typeof ruleSetNameOrIndex === 'number'
    ? ruleSets[ruleSetNameOrIndex]
    : ruleSets.find(rs => rs.name === ruleSetNameOrIndex);
  
  if (!ruleSet) {
    return [];
  }
  
  const chain: string[] = [];
  const visited = new Set<string>();
  let current: RuleSet | undefined = ruleSet;
  
  while (current) {
    if (visited.has(current.name)) {
      chain.unshift(`${current.name} (circular!)`);
      break;
    }
    visited.add(current.name);
    chain.unshift(current.name); // Add to front for parent-first order
    
    if (current.extends) {
      current = ruleSets.find(rs => rs.name === current!.extends);
    } else {
      current = undefined;
    }
  }
  
  return chain;
}

// ============================================================================
// Inheritance Validation
// ============================================================================

/**
 * Result of ruleset inheritance validation.
 */
export interface InheritanceValidationResult {
  /** Whether all inheritance relationships are valid */
  isValid: boolean;
  /** Array of error messages for invalid inheritance */
  errors: string[];
}

/**
 * Validate ruleset inheritance for circular references and missing parents.
 * 
 * @param template - The template containing all rulesets
 * @returns Validation result with isValid flag and error messages
 * 
 * @example
 * ```ts
 * const result = validateRuleSetInheritance(template);
 * if (!result.isValid) {
 *   console.error('Inheritance errors:', result.errors);
 * }
 * ```
 */
export function validateRuleSetInheritance(template: Template): InheritanceValidationResult {
  const ruleSets = template.ruleSets ?? [];
  const errors: string[] = [];
  const ruleSetNames = new Set(ruleSets.map(rs => rs.name));
  
  for (const ruleSet of ruleSets) {
    if (!ruleSet.extends) continue;
    
    // Check if parent exists
    if (!ruleSetNames.has(ruleSet.extends)) {
      errors.push(
        `RuleSet "${ruleSet.name}" extends non-existent ruleset "${ruleSet.extends}"`
      );
      continue;
    }
    
    // Check for self-reference
    if (ruleSet.extends === ruleSet.name) {
      errors.push(`RuleSet "${ruleSet.name}" cannot extend itself`);
      continue;
    }
    
    // Check for circular inheritance
    const visited = new Set<string>();
    let current: string | undefined = ruleSet.name;
    const path: string[] = [];
    
    while (current) {
      if (visited.has(current)) {
        // Found a cycle - report it
        const cycleStart = path.indexOf(current);
        const cycle = path.slice(cycleStart).concat(current);
        errors.push(
          `Circular inheritance detected: ${cycle.join(' → ')}`
        );
        break;
      }
      
      visited.add(current);
      path.push(current);
      
      const currentRuleSet = ruleSets.find(rs => rs.name === current);
      current = currentRuleSet?.extends;
    }
  }
  
  // Deduplicate errors (same cycle may be detected from multiple starting points)
  const uniqueErrors = [...new Set(errors)];
  
  return {
    isValid: uniqueErrors.length === 0,
    errors: uniqueErrors,
  };
}

// ============================================================================
// RuleSet Utilities
// ============================================================================

/**
 * Find a ruleset by name.
 * 
 * @param template - The template containing rulesets
 * @param name - Name of the ruleset to find
 * @returns The ruleset if found, undefined otherwise
 */
export function findRuleSet(template: Template, name: string): RuleSet | undefined {
  return template.ruleSets?.find(rs => rs.name === name);
}

/**
 * Find a ruleset index by name.
 * 
 * @param template - The template containing rulesets
 * @param name - Name of the ruleset to find
 * @returns Index of the ruleset if found, -1 otherwise
 */
export function findRuleSetIndex(template: Template, name: string): number {
  return template.ruleSets?.findIndex(rs => rs.name === name) ?? -1;
}

/**
 * Get all rulesets that extend a given ruleset.
 * 
 * @param template - The template containing rulesets
 * @param parentName - Name of the parent ruleset
 * @returns Array of rulesets that extend the parent
 */
export function getChildRuleSets(template: Template, parentName: string): RuleSet[] {
  return template.ruleSets?.filter(rs => rs.extends === parentName) ?? [];
}

/**
 * Check if a ruleset has any children (is extended by other rulesets).
 * 
 * @param template - The template containing rulesets
 * @param name - Name of the ruleset to check
 * @returns True if the ruleset is extended by at least one other ruleset
 */
export function hasChildRuleSets(template: Template, name: string): boolean {
  return template.ruleSets?.some(rs => rs.extends === name) ?? false;
}
