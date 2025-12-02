import { describe, it, expect } from 'vitest';
import type { Template, Rule } from '@guido/types';
import { RuleState } from '@guido/types';
import {
  resolveRuleSetRules,
  getDefaultRules,
  getRuleSetRules,
  getRuleSetInheritanceChain,
  validateRuleSetInheritance,
  findRuleSet,
  findRuleSetIndex,
  getChildRuleSets,
  hasChildRuleSets,
} from './rulesetUtils.js';

/**
 * Tests for RuleSet utilities - inheritance, resolution, and validation
 */
describe('rulesetUtils', () => {
  // Helper to create mock rules
  const createRule = (description: string, conditionField: string, targetField: string): Rule => ({
    description,
    conditions: [{ name: conditionField, state: RuleState.Set }],
    targets: [{ name: targetField, state: RuleState.Set }],
  });

  // Helper to create a mock template with inheritance
  const createTemplateWithInheritance = (): Template => ({
    name: 'Inheritance Test',
    fileName: 'test.json',
    version: '1.0.0',
    description: '',
    owner: 'test',
    fields: [],
    ruleSets: [
      {
        name: 'Base',
        description: 'Base ruleset',
        tags: ['base'],
        rules: [
          createRule('Base rule 1', 'base.field1', 'base.target1'),
          createRule('Base rule 2', 'base.field2', 'base.target2'),
        ],
      },
      {
        name: 'Development',
        description: 'Development settings',
        tags: ['dev'],
        extends: 'Base',
        rules: [
          createRule('Dev rule', 'dev.field', 'dev.target'),
        ],
      },
      {
        name: 'Production',
        description: 'Production settings',
        tags: ['prod'],
        extends: 'Base',
        rules: [
          createRule('Prod rule 1', 'prod.field1', 'prod.target1'),
          createRule('Prod rule 2', 'prod.field2', 'prod.target2'),
        ],
      },
      {
        name: 'ProductionSecure',
        description: 'Production with security',
        tags: ['prod', 'secure'],
        extends: 'Production',
        rules: [
          createRule('Security rule', 'security.enabled', 'security.enforced'),
        ],
      },
      {
        name: 'Standalone',
        description: 'Standalone ruleset (no inheritance)',
        tags: ['standalone'],
        rules: [
          createRule('Standalone rule', 'standalone.field', 'standalone.target'),
        ],
      },
    ],
  });

  // ============================================================================
  // resolveRuleSetRules - Rule Resolution with Inheritance
  // ============================================================================

  describe('resolveRuleSetRules', () => {
    it('should return own rules for ruleset without inheritance', () => {
      const template = createTemplateWithInheritance();
      const rules = resolveRuleSetRules(template, 'Standalone');
      
      expect(rules).toHaveLength(1);
      expect(rules[0].description).toBe('Standalone rule');
    });

    it('should include parent rules before own rules', () => {
      const template = createTemplateWithInheritance();
      const rules = resolveRuleSetRules(template, 'Development');
      
      // Should have Base rules (2) + Development rules (1) = 3
      expect(rules).toHaveLength(3);
      // Parent rules come first
      expect(rules[0].description).toBe('Base rule 1');
      expect(rules[1].description).toBe('Base rule 2');
      // Own rules come last
      expect(rules[2].description).toBe('Dev rule');
    });

    it('should resolve multi-level inheritance (grandparent → parent → child)', () => {
      const template = createTemplateWithInheritance();
      const rules = resolveRuleSetRules(template, 'ProductionSecure');
      
      // Base (2) + Production (2) + ProductionSecure (1) = 5
      expect(rules).toHaveLength(5);
      expect(rules[0].description).toBe('Base rule 1');
      expect(rules[1].description).toBe('Base rule 2');
      expect(rules[2].description).toBe('Prod rule 1');
      expect(rules[3].description).toBe('Prod rule 2');
      expect(rules[4].description).toBe('Security rule');
    });

    it('should work with numeric index', () => {
      const template = createTemplateWithInheritance();
      const rulesByName = resolveRuleSetRules(template, 'Development');
      const rulesByIndex = resolveRuleSetRules(template, 1); // Development is at index 1
      
      expect(rulesByIndex).toEqual(rulesByName);
    });

    it('should return empty array for non-existent ruleset', () => {
      const template = createTemplateWithInheritance();
      const rules = resolveRuleSetRules(template, 'NonExistent');
      
      expect(rules).toEqual([]);
    });

    it('should throw on circular inheritance', () => {
      const template: Template = {
        name: 'Circular Test',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          { name: 'A', description: '', tags: [], extends: 'B', rules: [] },
          { name: 'B', description: '', tags: [], extends: 'A', rules: [] },
        ],
      };
      
      expect(() => resolveRuleSetRules(template, 'A')).toThrow(/[Cc]ircular/);
    });

    it('should handle missing parent gracefully (no crash)', () => {
      const template: Template = {
        name: 'Missing Parent Test',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          { 
            name: 'Child', 
            description: '', 
            tags: [],
            extends: 'NonExistent', // Parent doesn't exist
            rules: [createRule('Child rule', 'field', 'target')],
          },
        ],
      };
      
      // Should return child's own rules without crashing
      const rules = resolveRuleSetRules(template, 'Child');
      expect(rules).toHaveLength(1);
      expect(rules[0].description).toBe('Child rule');
    });
  });

  // ============================================================================
  // getDefaultRules / getRuleSetRules - Convenience Functions
  // ============================================================================

  describe('getDefaultRules', () => {
    it('should return first ruleset rules without inheritance by default', () => {
      const template = createTemplateWithInheritance();
      const rules = getDefaultRules(template);
      
      expect(rules).toHaveLength(2); // Only Base's own rules
      expect(rules[0].description).toBe('Base rule 1');
    });

    it('should resolve inheritance when requested', () => {
      // Create a simpler template for this specific test
      const template: Template = {
        name: 'Test',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          {
            name: 'Child',
            description: 'Child ruleset',
            tags: [],
            extends: 'Parent',
            rules: [createRule('Child rule', 'child.field', 'child.target')],
          },
          {
            name: 'Parent',
            description: 'Parent ruleset',
            tags: [],
            rules: [
              createRule('Parent rule 1', 'parent.field1', 'parent.target1'),
              createRule('Parent rule 2', 'parent.field2', 'parent.target2'),
            ],
          },
        ],
      };
      
      // Without inheritance: only Child's 1 rule
      const rulesWithoutInheritance = getDefaultRules(template, false);
      expect(rulesWithoutInheritance).toHaveLength(1);
      
      // With inheritance: Parent's 2 rules + Child's 1 rule = 3
      const rulesWithInheritance = getDefaultRules(template, true);
      expect(rulesWithInheritance).toHaveLength(3);
    });

    it('should return empty array for template without rulesets', () => {
      const template: Template = {
        name: 'Empty',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [],
      };
      
      expect(getDefaultRules(template)).toEqual([]);
      expect(getDefaultRules(template, true)).toEqual([]);
    });
  });

  describe('getRuleSetRules', () => {
    it('should return specific ruleset rules by index', () => {
      const template = createTemplateWithInheritance();
      const rules = getRuleSetRules(template, 2); // Production
      
      expect(rules).toHaveLength(2);
      expect(rules[0].description).toBe('Prod rule 1');
    });

    it('should resolve inheritance when requested', () => {
      const template = createTemplateWithInheritance();
      const rules = getRuleSetRules(template, 2, true); // Production with inheritance
      
      // Base (2) + Production (2) = 4
      expect(rules).toHaveLength(4);
    });
  });

  // ============================================================================
  // getRuleSetInheritanceChain - Chain Traversal
  // ============================================================================

  describe('getRuleSetInheritanceChain', () => {
    it('should return single-element chain for non-inheriting ruleset', () => {
      const template = createTemplateWithInheritance();
      const chain = getRuleSetInheritanceChain(template, 'Base');
      
      expect(chain).toEqual(['Base']);
    });

    it('should return parent-first chain for single inheritance', () => {
      const template = createTemplateWithInheritance();
      const chain = getRuleSetInheritanceChain(template, 'Development');
      
      expect(chain).toEqual(['Base', 'Development']);
    });

    it('should return full chain for multi-level inheritance', () => {
      const template = createTemplateWithInheritance();
      const chain = getRuleSetInheritanceChain(template, 'ProductionSecure');
      
      expect(chain).toEqual(['Base', 'Production', 'ProductionSecure']);
    });

    it('should work with numeric index', () => {
      const template = createTemplateWithInheritance();
      const chain = getRuleSetInheritanceChain(template, 3); // ProductionSecure
      
      expect(chain).toEqual(['Base', 'Production', 'ProductionSecure']);
    });

    it('should return empty array for non-existent ruleset', () => {
      const template = createTemplateWithInheritance();
      const chain = getRuleSetInheritanceChain(template, 'NonExistent');
      
      expect(chain).toEqual([]);
    });

    it('should mark circular inheritance in chain', () => {
      const template: Template = {
        name: 'Circular Test',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          { name: 'A', description: '', tags: [], extends: 'B', rules: [] },
          { name: 'B', description: '', tags: [], extends: 'A', rules: [] },
        ],
      };
      
      const chain = getRuleSetInheritanceChain(template, 'A');
      // Should contain circular marker
      expect(chain.join(' → ')).toContain('circular');
    });
  });

  // ============================================================================
  // validateRuleSetInheritance - Validation
  // ============================================================================

  describe('validateRuleSetInheritance', () => {
    it('should validate correct inheritance structure', () => {
      const template = createTemplateWithInheritance();
      const result = validateRuleSetInheritance(template);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing parent ruleset', () => {
      const template: Template = {
        name: 'Missing Parent',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          { name: 'Child', description: '', tags: [], extends: 'NonExistent', rules: [] },
        ],
      };
      
      const result = validateRuleSetInheritance(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('non-existent');
      expect(result.errors[0]).toContain('NonExistent');
    });

    it('should detect self-referencing inheritance', () => {
      const template: Template = {
        name: 'Self Reference',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          { name: 'SelfRef', description: '', tags: [], extends: 'SelfRef', rules: [] },
        ],
      };
      
      const result = validateRuleSetInheritance(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('cannot extend itself'))).toBe(true);
    });

    it('should detect circular inheritance (A → B → A)', () => {
      const template: Template = {
        name: 'Circular',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          { name: 'A', description: '', tags: [], extends: 'B', rules: [] },
          { name: 'B', description: '', tags: [], extends: 'A', rules: [] },
        ],
      };
      
      const result = validateRuleSetInheritance(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular'))).toBe(true);
    });

    it('should detect longer circular chains (A → B → C → A)', () => {
      const template: Template = {
        name: 'Long Circular',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          { name: 'A', description: '', tags: [], extends: 'B', rules: [] },
          { name: 'B', description: '', tags: [], extends: 'C', rules: [] },
          { name: 'C', description: '', tags: [], extends: 'A', rules: [] },
        ],
      };
      
      const result = validateRuleSetInheritance(template);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular'))).toBe(true);
    });

    it('should handle template without rulesets', () => {
      const template: Template = {
        name: 'Empty',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [],
      };
      
      const result = validateRuleSetInheritance(template);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate template with no extends fields', () => {
      const template: Template = {
        name: 'No Inheritance',
        fileName: 'test.json',
        version: '1.0.0',
        description: '',
        owner: 'test',
        fields: [],
        ruleSets: [
          { name: 'A', description: '', tags: [], rules: [] },
          { name: 'B', description: '', tags: [], rules: [] },
        ],
      };
      
      const result = validateRuleSetInheritance(template);
      
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================================================
  // findRuleSet / findRuleSetIndex - Lookup Functions
  // ============================================================================

  describe('findRuleSet', () => {
    it('should find ruleset by exact name', () => {
      const template = createTemplateWithInheritance();
      const found = findRuleSet(template, 'Production');
      
      expect(found).toBeDefined();
      expect(found?.name).toBe('Production');
      expect(found?.tags).toContain('prod');
    });

    it('should return undefined for non-existent name', () => {
      const template = createTemplateWithInheritance();
      const found = findRuleSet(template, 'NonExistent');
      
      expect(found).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const template = createTemplateWithInheritance();
      const found = findRuleSet(template, 'production'); // lowercase
      
      expect(found).toBeUndefined();
    });
  });

  describe('findRuleSetIndex', () => {
    it('should find index by name', () => {
      const template = createTemplateWithInheritance();
      const index = findRuleSetIndex(template, 'Production');
      
      expect(index).toBe(2);
    });

    it('should return -1 for non-existent name', () => {
      const template = createTemplateWithInheritance();
      const index = findRuleSetIndex(template, 'NonExistent');
      
      expect(index).toBe(-1);
    });
  });

  // ============================================================================
  // getChildRuleSets / hasChildRuleSets - Child Lookup
  // ============================================================================

  describe('getChildRuleSets', () => {
    it('should find all rulesets extending a parent', () => {
      const template = createTemplateWithInheritance();
      const children = getChildRuleSets(template, 'Base');
      
      expect(children).toHaveLength(2); // Development and Production
      expect(children.map(c => c.name).sort()).toEqual(['Development', 'Production']);
    });

    it('should return empty array for ruleset with no children', () => {
      const template = createTemplateWithInheritance();
      const children = getChildRuleSets(template, 'Standalone');
      
      expect(children).toHaveLength(0);
    });

    it('should return empty array for non-existent parent', () => {
      const template = createTemplateWithInheritance();
      const children = getChildRuleSets(template, 'NonExistent');
      
      expect(children).toHaveLength(0);
    });

    it('should find single child for intermediate ruleset', () => {
      const template = createTemplateWithInheritance();
      const children = getChildRuleSets(template, 'Production');
      
      expect(children).toHaveLength(1);
      expect(children[0].name).toBe('ProductionSecure');
    });
  });

  describe('hasChildRuleSets', () => {
    it('should return true for parent with children', () => {
      const template = createTemplateWithInheritance();
      
      expect(hasChildRuleSets(template, 'Base')).toBe(true);
      expect(hasChildRuleSets(template, 'Production')).toBe(true);
    });

    it('should return false for leaf rulesets', () => {
      const template = createTemplateWithInheritance();
      
      expect(hasChildRuleSets(template, 'ProductionSecure')).toBe(false);
      expect(hasChildRuleSets(template, 'Development')).toBe(false);
      expect(hasChildRuleSets(template, 'Standalone')).toBe(false);
    });

    it('should return false for non-existent ruleset', () => {
      const template = createTemplateWithInheritance();
      
      expect(hasChildRuleSets(template, 'NonExistent')).toBe(false);
    });
  });
});
