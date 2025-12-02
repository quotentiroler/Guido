/**
 * Tests for MCP Server template utilities
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import type { Template, Field, Rule } from '@guido/types';
import { RuleState } from '@guido/types';
import { getDefaultRules, getRuleSetRules } from '@guido/core';
import {
  migrateTemplate,
  loadTemplate,
  saveTemplate,
  findField,
  findFieldIndex,
  applyRulesToFields,
  getAffectedFields,
  isFieldRequiredInTemplate,
  generateContrapositive,
  renameField,
  duplicateField,
  recordChange,
  getChanges,
  clearChanges,
} from './template-utils';

// Mock fs module
vi.mock('fs');

// Helper to create a minimal valid template
function createTemplate(overrides: Partial<Template> = {}): Template {
  return {
    name: 'Test Template',
    fileName: 'test.guido.json',
    version: '1.0.0',
    description: 'Test description',
    owner: 'test',
    fields: [],
    ruleSets: [{ name: 'Default', description: 'Default ruleset', tags: [], rules: [] }],
    ...overrides,
  };
}

// Helper to create a field
function createField(name: string, value: string | number | boolean = '', overrides: Partial<Field> = {}): Field {
  return {
    name,
    value,
    info: '',
    example: '',
    range: 'string',
    ...overrides,
  };
}

describe('template-utils', () => {
  // ============================================================================
  // MIGRATION TESTS
  // ============================================================================
  describe('migrateTemplate', () => {
    it('should return template unchanged if it already has ruleSets', () => {
      const template = createTemplate({
        ruleSets: [{
          name: 'Default',
          description: 'Test ruleset',
          tags: [],
          rules: [{ targets: [{ name: 'field1', state: RuleState.Set }] }],
        }],
      });

      const result = migrateTemplate(template);
      
      expect(result).toEqual(template);
      expect(result.ruleSets).toHaveLength(1);
      expect(result.ruleSets[0].rules).toHaveLength(1);
    });

    it('should migrate legacy rules array to ruleSets', () => {
      const legacyTemplate = {
        ...createTemplate({ ruleSets: [] as unknown as Template['ruleSets'] }),
        rules: [
          { targets: [{ name: 'field1', state: RuleState.Set }] },
          { targets: [{ name: 'field2', state: RuleState.Set }] },
        ],
      };
      // Simulate legacy - no ruleSets
      delete (legacyTemplate as { ruleSets?: unknown }).ruleSets;

      const result = migrateTemplate(legacyTemplate as unknown as Template & { rules?: Rule[] });

      expect(result.ruleSets).toBeDefined();
      expect(result.ruleSets).toHaveLength(1);
      expect(result.ruleSets[0].name).toBe('Default');
      expect(result.ruleSets[0].description).toBe('Migrated from legacy rules array');
      expect(result.ruleSets[0].rules).toHaveLength(2);
      expect((result as { rules?: Rule[] }).rules).toBeUndefined();
    });

    it('should create empty default ruleset if no rules exist', () => {
      const template = createTemplate();
      // Create a template without ruleSets to test migration
      const noRuleSets = { ...template, ruleSets: undefined } as unknown as Template;

      const result = migrateTemplate(noRuleSets);

      expect(result.ruleSets).toBeDefined();
      expect(result.ruleSets).toHaveLength(1);
      expect(result.ruleSets[0].name).toBe('Default');
      expect(result.ruleSets[0].rules).toEqual([]);
    });
  });

  // ============================================================================
  // RULESET ACCESSOR TESTS
  // ============================================================================
  describe('getDefaultRules', () => {
    it('should return rules from first ruleset', () => {
      const template = createTemplate({
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [{ targets: [{ name: 'field1', state: RuleState.Set }] }],
        }],
      });

      const rules = getDefaultRules(template);

      expect(rules).toHaveLength(1);
      expect(rules[0].targets[0].name).toBe('field1');
    });

    it('should return empty array if no ruleSets', () => {
      const template = createTemplate();
      delete (template as { ruleSets?: unknown }).ruleSets;

      expect(getDefaultRules(template)).toEqual([]);
    });
  });

  describe('getRuleSetRules', () => {
    it('should return rules from specific ruleset index', () => {
      const template = createTemplate({
        ruleSets: [
          { name: 'First', description: '', tags: [], rules: [{ targets: [{ name: 'a', state: RuleState.Set }] }] },
          { name: 'Second', description: '', tags: [], rules: [{ targets: [{ name: 'b', state: RuleState.Set }] }] },
        ],
      });

      expect(getRuleSetRules(template, 0)[0].targets[0].name).toBe('a');
      expect(getRuleSetRules(template, 1)[0].targets[0].name).toBe('b');
    });

    it('should return empty array for invalid index', () => {
      const template = createTemplate();

      expect(getRuleSetRules(template, 99)).toEqual([]);
    });
  });

  // ============================================================================
  // FILE I/O TESTS
  // ============================================================================
  describe('loadTemplate', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should load and parse template file', () => {
      const template = createTemplate({
        fields: [createField('field1', 'test')],
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(template));

      const result = loadTemplate('/path/to/template.guido.json');

      expect(result.name).toBe('Test Template');
      expect(result.fields).toHaveLength(1);
    });

    it('should throw error if file not found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => loadTemplate('/nonexistent.json'))
        .toThrow('Template file not found');
    });

    it('should migrate legacy template on load', () => {
      const legacyTemplate = {
        ...createTemplate(),
        rules: [{ targets: [{ name: 'field1', state: RuleState.Set }] }],
      };
      delete (legacyTemplate as { ruleSets?: unknown }).ruleSets;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(legacyTemplate));

      const result = loadTemplate('/path/to/legacy.json');

      expect(result.ruleSets).toBeDefined();
      expect(result.ruleSets[0].rules).toHaveLength(1);
    });
  });

  describe('saveTemplate', () => {
    it('should write template to file', () => {
      const template = createTemplate();

      saveTemplate('/path/to/output.json', template);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('output.json'),
        expect.stringContaining('"name": "Test Template"'),
        'utf-8'
      );
    });
  });

  // ============================================================================
  // FIELD FINDER TESTS
  // ============================================================================
  describe('findField', () => {
    const template = createTemplate({
      fields: [
        createField('field1', 'a'),
        createField('field2', 'b'),
      ],
    });

    it('should find field by name', () => {
      const field = findField(template, 'field1');
      expect(field).toBeDefined();
      expect(field!.value).toBe('a');
    });

    it('should return undefined for non-existent field', () => {
      expect(findField(template, 'nonexistent')).toBeUndefined();
    });
  });

  describe('findFieldIndex', () => {
    const template = createTemplate({
      fields: [
        createField('field1', 'a'),
        createField('field2', 'b'),
      ],
    });

    it('should return correct index', () => {
      expect(findFieldIndex(template, 'field1')).toBe(0);
      expect(findFieldIndex(template, 'field2')).toBe(1);
    });

    it('should return -1 for non-existent field', () => {
      expect(findFieldIndex(template, 'nonexistent')).toBe(-1);
    });
  });

  // ============================================================================
  // RULE APPLICATION TESTS
  // ============================================================================
  describe('applyRulesToFields', () => {
    it('should apply rules and return updated fields', () => {
      const fields: Field[] = [
        createField('trigger', 'yes', { checked: true }),
        createField('target', '', { checked: false }),
      ];
      const rules: Rule[] = [{
        conditions: [{ name: 'trigger', state: RuleState.Set }],
        targets: [{ name: 'target', state: RuleState.Set }],
      }];

      const { updatedFields } = applyRulesToFields(fields, rules);

      expect(updatedFields.find(f => f.name === 'target')!.checked).toBe(true);
    });

    it('should return empty appliedRules when no rules apply', () => {
      const fields: Field[] = [createField('field1', '', { checked: false })];

      const { appliedRules } = applyRulesToFields(fields, []);

      expect(appliedRules).toEqual([]);
    });
  });

  // ============================================================================
  // AFFECTED FIELDS TESTS
  // ============================================================================
  describe('getAffectedFields', () => {
    it('should return fields affected by changing a field', () => {
      const template = createTemplate({
        fields: [
          createField('trigger'),
          createField('target1'),
          createField('target2'),
        ],
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [{
            conditions: [{ name: 'trigger', state: RuleState.Set }],
            targets: [
              { name: 'target1', state: RuleState.Set },
              { name: 'target2', state: RuleState.Set },
            ],
          }],
        }],
      });

      const affected = getAffectedFields(template, 'trigger');

      expect(affected).toContain('target1');
      expect(affected).toContain('target2');
      expect(affected).not.toContain('trigger');
    });

    it('should return empty array if field affects nothing', () => {
      const template = createTemplate({
        fields: [createField('lonely')],
      });

      expect(getAffectedFields(template, 'lonely')).toEqual([]);
    });
  });

  // ============================================================================
  // REQUIRED FIELD TESTS
  // ============================================================================
  describe('isFieldRequiredInTemplate', () => {
    it('should return true for unconditionally required field', () => {
      const template = createTemplate({
        fields: [createField('required')],
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [{
            // No conditions = unconditional
            targets: [{ name: 'required', state: RuleState.Set }],
          }],
        }],
      });

      expect(isFieldRequiredInTemplate(template, 'required')).toBe(true);
    });

    it('should return false for conditionally required field', () => {
      const template = createTemplate({
        fields: [createField('conditional')],
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [{
            conditions: [{ name: 'trigger', state: RuleState.Set }],
            targets: [{ name: 'conditional', state: RuleState.Set }],
          }],
        }],
      });

      expect(isFieldRequiredInTemplate(template, 'conditional')).toBe(false);
    });
  });

  // ============================================================================
  // CONTRAPOSITIVE TESTS
  // ============================================================================
  describe('generateContrapositive', () => {
    it('should generate contrapositive of a rule', () => {
      const rule: Rule = {
        description: 'If A then B',
        conditions: [{ name: 'A', state: RuleState.Set, not: false }],
        targets: [{ name: 'B', state: RuleState.Set, not: false }],
      };

      const contra = generateContrapositive(rule);

      expect(contra.description).toBe('Contrapositive: If A then B');
      expect(contra.conditions).toHaveLength(1);
      expect(contra.conditions![0].name).toBe('B');
      expect(contra.conditions![0].not).toBe(true); // Negated
      expect(contra.targets[0].name).toBe('A');
      expect(contra.targets[0].not).toBe(true); // Negated
    });

    it('should throw error for rule without conditions', () => {
      const rule: Rule = {
        targets: [{ name: 'B', state: RuleState.Set }],
      };

      expect(() => generateContrapositive(rule))
        .toThrow('Cannot generate contrapositive for a rule without conditions');
    });

    it('should handle already-negated conditions', () => {
      const rule: Rule = {
        conditions: [{ name: 'A', state: RuleState.Set, not: true }],
        targets: [{ name: 'B', state: RuleState.Set, not: true }],
      };

      const contra = generateContrapositive(rule);

      expect(contra.conditions![0].not).toBe(false); // Double negation
      expect(contra.targets[0].not).toBe(false);
    });
  });

  // ============================================================================
  // RENAME FIELD TESTS
  // ============================================================================
  describe('renameField', () => {
    it('should rename field and update rules', () => {
      const template = createTemplate({
        fields: [
          createField('oldName', 'test'),
          createField('other'),
        ],
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [{
            conditions: [{ name: 'oldName', state: RuleState.Set }],
            targets: [{ name: 'other', state: RuleState.Set }],
          }],
        }],
      });

      const result = renameField(template, 'oldName', 'newName');

      expect(template.fields[0].name).toBe('newName');
      expect(template.ruleSets[0].rules[0].conditions![0].name).toBe('newName');
      expect(result.updatedRules).toBe(1);
    });

    it('should throw if field not found', () => {
      const template = createTemplate();

      expect(() => renameField(template, 'nonexistent', 'newName'))
        .toThrow('Field "nonexistent" not found');
    });

    it('should throw if new name already exists', () => {
      const template = createTemplate({
        fields: [
          createField('field1'),
          createField('field2'),
        ],
      });

      expect(() => renameField(template, 'field1', 'field2'))
        .toThrow('Field "field2" already exists');
    });
  });

  // ============================================================================
  // DUPLICATE FIELD TESTS
  // ============================================================================
  describe('duplicateField', () => {
    it('should duplicate field with new name', () => {
      const template = createTemplate({
        fields: [
          createField('original', 'test', { checked: true, info: 'info' }),
        ],
      });

      const newField = duplicateField(template, 'original', 'copy');

      expect(template.fields).toHaveLength(2);
      expect(newField.name).toBe('copy');
      expect(newField.value).toBe('test');
      expect(newField.checked).toBe(false); // New field starts unchecked
      expect(newField.info).toBe('info');
    });

    it('should insert after source field', () => {
      const template = createTemplate({
        fields: [
          createField('first'),
          createField('second'),
          createField('third'),
        ],
      });

      duplicateField(template, 'first', 'firstCopy');

      expect(template.fields[0].name).toBe('first');
      expect(template.fields[1].name).toBe('firstCopy');
      expect(template.fields[2].name).toBe('second');
    });

    it('should throw if source not found', () => {
      const template = createTemplate();

      expect(() => duplicateField(template, 'nonexistent', 'copy'))
        .toThrow('Field "nonexistent" not found');
    });

    it('should throw if new name exists', () => {
      const template = createTemplate({
        fields: [
          createField('field1'),
          createField('field2'),
        ],
      });

      expect(() => duplicateField(template, 'field1', 'field2'))
        .toThrow('Field "field2" already exists');
    });
  });

  // ============================================================================
  // CHANGE TRACKING TESTS
  // ============================================================================
  describe('change tracking', () => {
    const testPath = '/test/template.json';

    beforeEach(() => {
      clearChanges(testPath);
    });

    it('should record and retrieve changes', () => {
      recordChange(testPath, 'field_update', { field: 'test', value: 'new' });
      recordChange(testPath, 'field_add', { field: 'newField' });

      const changes = getChanges(testPath);

      expect(changes).toHaveLength(2);
      expect(changes[0].type).toBe('field_update');
      expect(changes[1].type).toBe('field_add');
    });

    it('should clear changes', () => {
      recordChange(testPath, 'field_update', { field: 'test' });
      expect(getChanges(testPath)).toHaveLength(1);

      clearChanges(testPath);

      expect(getChanges(testPath)).toHaveLength(0);
    });

    it('should return empty array for path with no changes', () => {
      expect(getChanges('/unknown/path.json')).toEqual([]);
    });
  });
});
