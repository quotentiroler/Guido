import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import type { Template, Field } from '@guido/types';
import { RuleState } from '@guido/types';
import { applyRules } from '@guido/core';

// Mock the fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Note: findRuleSet tests are in packages/core/src/rulesetUtils.test.ts
// Note: validateRules tests are in src/__tests__/validateRules.test.ts  
// Note: applyRules tests are in src/__tests__/applyRules.test.ts
// This file focuses on CLI-specific template loading and compliance detection

describe('validateTemplate CLI logic', () => {
  const createMockTemplate = (): Template => ({
    name: 'Test Template',
    fileName: 'test.json',
    version: '1.0.0',
    description: 'Test template',
    owner: 'test',
    fields: [
      { name: 'field1', value: '', info: 'Field 1', example: 'example1', range: 'string', checked: false },
      { name: 'field2', value: '', info: 'Field 2', example: 'example2', range: 'string', checked: false },
      { name: 'field3', value: 'default', info: 'Field 3', example: 'example3', range: 'string', checked: true },
      { name: 'database.enabled', value: false, info: 'DB enabled', example: 'true', range: 'boolean', checked: true },
      { name: 'database.connection', value: '', info: 'DB connection', example: 'mongodb://localhost', range: 'string', checked: false },
    ],
    ruleSets: [
      {
        name: 'Test RuleSet',
        description: 'A test ruleset',
        tags: ['test', 'demo'],
        rules: [
          {
            description: 'Enable database connection when database is enabled',
            conditions: [{ name: 'database.enabled', state: RuleState.SetToValue, value: 'true' }],
            targets: [{ name: 'database.connection', state: RuleState.Set }],
          },
        ],
      },
      {
        name: 'Production RuleSet',
        description: 'Production ruleset',
        tags: ['production'],
        rules: [],
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('template loading', () => {
    it('should parse valid template JSON and preserve all properties', () => {
      const mockTemplate = createMockTemplate();
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockTemplate));
      
      const loadTemplate = (path: string): Template => {
        if (!existsSync(path)) {
          throw new Error(`Template file not found: ${path}`);
        }
        return JSON.parse(readFileSync(path, 'utf-8')) as Template;
      };
      
      const template = loadTemplate('/path/template.json');
      
      expect(template.name).toBe('Test Template');
      expect(template.fields).toHaveLength(5);
      expect(template.ruleSets).toHaveLength(2);
      expect(template.ruleSets?.[0].rules).toHaveLength(1);
      expect(template.ruleSets?.[0].tags).toEqual(['test', 'demo']);
    });

    it('should throw error for non-existent template file', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const loadTemplate = (path: string): Template => {
        if (!existsSync(path)) {
          throw new Error(`Template file not found: ${path}`);
        }
        return JSON.parse(readFileSync(path, 'utf-8')) as Template;
      };
      
      expect(() => loadTemplate('/path/nonexistent.json')).toThrow('Template file not found');
    });
  });

  describe('compliance detection', () => {
    it('should identify fields that would change after rule application', () => {
      const fields: Field[] = [
        { name: 'trigger', value: 'active', info: '', example: '', range: 'string', checked: true },
        { name: 'target', value: '', info: '', example: '', range: 'string', checked: false },
      ];
      const rules = [
        {
          description: 'Set target when trigger is set',
          conditions: [{ name: 'trigger', state: RuleState.Set }],
          targets: [{ name: 'target', state: RuleState.Set }],
        },
      ];
      
      const originalCheckedState = new Map(fields.map(f => [f.name, f.checked]));
      const result = applyRules(fields, rules);
      
      const changedFields = result.updatedFields.filter((f: Field) => 
        originalCheckedState.get(f.name) !== f.checked
      );
      
      expect(changedFields.some((f: Field) => f.name === 'target')).toBe(true);
    });

    it('should not change already-compliant fields', () => {
      const fields: Field[] = [
        { name: 'trigger', value: 'active', info: '', example: '', range: 'string', checked: true },
        { name: 'target', value: '', info: '', example: '', range: 'string', checked: true },
      ];
      const rules = [
        {
          description: 'Set target when trigger is set',
          conditions: [{ name: 'trigger', state: RuleState.Set }],
          targets: [{ name: 'target', state: RuleState.Set }],
        },
      ];
      
      const result = applyRules(fields, rules);
      const target = result.updatedFields.find((f: Field) => f.name === 'target');
      
      expect(target?.checked).toBe(true);
    });

    it('should count fields that rules will modify', () => {
      const fields: Field[] = [
        { name: 'field1', value: 'set', info: '', example: '', range: 'string', checked: true },
        { name: 'field2', value: '', info: '', example: '', range: 'string', checked: false },
        { name: 'field3', value: '', info: '', example: '', range: 'string', checked: false },
        { name: 'field4', value: '', info: '', example: '', range: 'string', checked: false },
      ];
      const rules = [
        {
          description: 'Set fields 2-4 when field1 is set',
          conditions: [{ name: 'field1', state: RuleState.Set }],
          targets: [
            { name: 'field2', state: RuleState.Set },
            { name: 'field3', state: RuleState.Set },
            { name: 'field4', state: RuleState.Set },
          ],
        },
      ];
      
      // Store original states before applyRules modifies them
      const originalCheckedState = new Map(fields.map(f => [f.name, f.checked]));
      const result = applyRules(fields, rules);
      
      // Count how many became checked that weren't before
      const newlyCheckedCount = result.updatedFields.filter((f: Field) => 
        f.checked && originalCheckedState.get(f.name) === false
      ).length;
      
      // 3 fields should be newly checked (field2, field3, field4)
      expect(newlyCheckedCount).toBe(3);
    });
  });
});
