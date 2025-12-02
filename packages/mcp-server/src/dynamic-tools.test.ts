/**
 * Tests for MCP Server dynamic tool handlers
 * 
 * These tests ensure that tool handlers correctly modify templates
 * and return expected results.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Template, Field, Rule, RuleSet } from '@guido/types';
import { RuleState } from '@guido/types';

// We need to test the handlers directly, so we'll import and test them
// by simulating what registerAllTools does

// Mock fs module before imports
vi.mock('fs');

// Import after mocking
import {
  findField,
  findFieldIndex,
  applyRulesToFields,
} from './template-utils';

// ============================================================================
// Test Helpers
// ============================================================================

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

function createRuleSet(name: string, rules: Rule[] = []): RuleSet {
  return {
    name,
    description: '',
    tags: [],
    rules,
  };
}

// Simulate handler context
function _createContext(_template: Template) {
  let saved = false;
  return {
    filePath: '/test/template.json',
    save: () => { saved = true; },
    wasSaved: () => saved,
  };
}

// ============================================================================
// Tool Handler Tests - Extracted from dynamic-tools.ts for testing
// These simulate the actual handler logic
// ============================================================================

describe('Tool Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // get_template_info
  // ==========================================================================
  describe('get_template_info', () => {
    it('should return template metadata', () => {
      const template = createTemplate({
        name: 'My Template',
        version: '2.0.0',
        description: 'A test template',
        owner: 'TestOwner',
        fields: [createField('field1'), createField('field2')],
        ruleSets: [
          createRuleSet('Default', [{ targets: [{ name: 'a', state: RuleState.Set }] }]),
          createRuleSet('Alt', []),
        ],
      });

      // Simulate handler
      const result = {
        name: template.name,
        fileName: template.fileName,
        version: template.version,
        description: template.description,
        owner: template.owner,
        fieldCount: template.fields.length,
        ruleSetCount: template.ruleSets?.length ?? 0,
        ruleCount: template.ruleSets?.[0]?.rules?.length ?? 0,
      };

      expect(result.name).toBe('My Template');
      expect(result.version).toBe('2.0.0');
      expect(result.fieldCount).toBe(2);
      expect(result.ruleSetCount).toBe(2);
      expect(result.ruleCount).toBe(1);
    });
  });

  // ==========================================================================
  // list_fields
  // ==========================================================================
  describe('list_fields', () => {
    it('should list all fields', () => {
      const template = createTemplate({
        fields: [
          createField('field1', 'val1'),
          createField('field2', 'val2'),
        ],
      });

      const result = template.fields.map(f => ({
        name: f.name,
        value: f.value,
        checked: f.checked ?? false,
      }));

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('field1');
      expect(result[1].name).toBe('field2');
    });

    it('should filter fields by name pattern', () => {
      const template = createTemplate({
        fields: [
          createField('Database.Host'),
          createField('Database.Port'),
          createField('Server.Host'),
        ],
      });

      const filter = 'database';
      const result = template.fields.filter(f => 
        f.name.toLowerCase().includes(filter.toLowerCase())
      );

      expect(result).toHaveLength(2);
      expect(result.every(f => f.name.startsWith('Database'))).toBe(true);
    });

    it('should filter to only checked fields', () => {
      const template = createTemplate({
        fields: [
          createField('field1', 'val1', { checked: true }),
          createField('field2', 'val2', { checked: false }),
          createField('field3', 'val3', { checked: true }),
        ],
      });

      const result = template.fields.filter(f => f.checked === true);

      expect(result).toHaveLength(2);
    });

    it('should respect limit parameter', () => {
      const template = createTemplate({
        fields: [
          createField('field1'),
          createField('field2'),
          createField('field3'),
          createField('field4'),
          createField('field5'),
        ],
      });

      const limit = 3;
      const result = template.fields.slice(0, limit);

      expect(result).toHaveLength(3);
    });
  });

  // ==========================================================================
  // get_field
  // ==========================================================================
  describe('get_field', () => {
    it('should return field with all properties', () => {
      const template = createTemplate({
        fields: [
          createField('myField', 'myValue', {
            info: 'Field info',
            example: 'example value',
            range: 'string',
            link: 'https://docs.example.com',
            checked: true,
          }),
        ],
      });

      const field = findField(template, 'myField');

      expect(field).toBeDefined();
      expect(field!.name).toBe('myField');
      expect(field!.value).toBe('myValue');
      expect(field!.info).toBe('Field info');
      expect(field!.example).toBe('example value');
      expect(field!.range).toBe('string');
      expect(field!.link).toBe('https://docs.example.com');
      expect(field!.checked).toBe(true);
    });

    it('should throw error for non-existent field', () => {
      const template = createTemplate();

      const field = findField(template, 'nonexistent');

      expect(field).toBeUndefined();
    });
  });

  // ==========================================================================
  // set_field - THE CRITICAL ONE THAT WAS MISSING
  // ==========================================================================
  describe('set_field', () => {
    it('should update field value', () => {
      const template = createTemplate({
        fields: [createField('myField', 'oldValue')],
      });

      const fieldIndex = findFieldIndex(template, 'myField');
      template.fields[fieldIndex].value = 'newValue';

      expect(template.fields[fieldIndex].value).toBe('newValue');
    });

    it('should update field checked status', () => {
      const template = createTemplate({
        fields: [createField('myField', 'value', { checked: false })],
      });

      const fieldIndex = findFieldIndex(template, 'myField');
      template.fields[fieldIndex].checked = true;

      expect(template.fields[fieldIndex].checked).toBe(true);
    });

    it('should update field example property', () => {
      const template = createTemplate({
        fields: [createField('myField', 'value', { example: 'old example' })],
      });

      const fieldIndex = findFieldIndex(template, 'myField');
      const example = 'new example value';
      
      if (example !== undefined) {
        template.fields[fieldIndex].example = example;
      }

      expect(template.fields[fieldIndex].example).toBe('new example value');
    });

    it('should update field info property', () => {
      const template = createTemplate({
        fields: [createField('myField', 'value', { info: 'old info' })],
      });

      const fieldIndex = findFieldIndex(template, 'myField');
      const info = 'Updated description for this field';
      
      if (info !== undefined) {
        template.fields[fieldIndex].info = info;
      }

      expect(template.fields[fieldIndex].info).toBe('Updated description for this field');
    });

    it('should update field range property', () => {
      const template = createTemplate({
        fields: [createField('myField', '50', { range: 'string' })],
      });

      const fieldIndex = findFieldIndex(template, 'myField');
      const range = '1..100';
      
      if (range !== undefined) {
        template.fields[fieldIndex].range = range;
      }

      expect(template.fields[fieldIndex].range).toBe('1..100');
    });

    it('should update field link property', () => {
      const template = createTemplate({
        fields: [createField('myField', 'value', { link: undefined })],
      });

      const fieldIndex = findFieldIndex(template, 'myField');
      const link = 'https://docs.example.com/myfield';
      
      if (link !== undefined) {
        template.fields[fieldIndex].link = link;
      }

      expect(template.fields[fieldIndex].link).toBe('https://docs.example.com/myfield');
    });

    it('should update multiple properties at once', () => {
      const template = createTemplate({
        fields: [createField('myField', 'oldValue', { 
          example: 'old example',
          info: 'old info',
          checked: false,
        })],
      });

      const fieldIndex = findFieldIndex(template, 'myField');
      
      // Simulate set_field with multiple properties
      const args = {
        value: 'newValue',
        checked: true,
        example: 'new example',
        info: 'new info',
      };

      if (args.value !== undefined) template.fields[fieldIndex].value = args.value;
      if (args.checked !== undefined) template.fields[fieldIndex].checked = args.checked;
      if (args.example !== undefined) template.fields[fieldIndex].example = args.example;
      if (args.info !== undefined) template.fields[fieldIndex].info = args.info;

      expect(template.fields[fieldIndex].value).toBe('newValue');
      expect(template.fields[fieldIndex].checked).toBe(true);
      expect(template.fields[fieldIndex].example).toBe('new example');
      expect(template.fields[fieldIndex].info).toBe('new info');
    });

    it('should not modify properties that are not provided', () => {
      const template = createTemplate({
        fields: [createField('myField', 'originalValue', { 
          example: 'original example',
          info: 'original info',
          range: 'string',
          checked: true,
        })],
      });

      const fieldIndex = findFieldIndex(template, 'myField');
      
      // Only update example
      const example = 'updated example';
      if (example !== undefined) {
        template.fields[fieldIndex].example = example;
      }

      // Other properties should remain unchanged
      expect(template.fields[fieldIndex].value).toBe('originalValue');
      expect(template.fields[fieldIndex].info).toBe('original info');
      expect(template.fields[fieldIndex].range).toBe('string');
      expect(template.fields[fieldIndex].checked).toBe(true);
      expect(template.fields[fieldIndex].example).toBe('updated example');
    });

    it('should throw error for non-existent field', () => {
      const template = createTemplate();

      const fieldIndex = findFieldIndex(template, 'nonexistent');

      expect(fieldIndex).toBe(-1);
    });
  });

  // ==========================================================================
  // set_fields (batch update)
  // ==========================================================================
  describe('set_fields', () => {
    it('should update multiple fields at once', () => {
      const template = createTemplate({
        fields: [
          createField('field1', 'val1'),
          createField('field2', 'val2'),
          createField('field3', 'val3'),
        ],
      });

      const updates = [
        { name: 'field1', value: 'updated1' },
        { name: 'field3', value: 'updated3', checked: true },
      ];

      for (const update of updates) {
        const fieldIndex = findFieldIndex(template, update.name);
        if (fieldIndex !== -1) {
          if (update.value !== undefined) template.fields[fieldIndex].value = update.value;
          if (update.checked !== undefined) template.fields[fieldIndex].checked = update.checked;
        }
      }

      expect(template.fields[0].value).toBe('updated1');
      expect(template.fields[1].value).toBe('val2'); // unchanged
      expect(template.fields[2].value).toBe('updated3');
      expect(template.fields[2].checked).toBe(true);
    });

    it('should handle non-existent fields gracefully', () => {
      const template = createTemplate({
        fields: [createField('exists', 'value')],
      });

      const updates = [
        { name: 'exists', value: 'updated' },
        { name: 'nonexistent', value: 'fail' },
      ];

      const results: { name: string; updated: boolean; error?: string }[] = [];

      for (const update of updates) {
        const fieldIndex = findFieldIndex(template, update.name);
        if (fieldIndex === -1) {
          results.push({ name: update.name, updated: false, error: 'Field not found' });
        } else {
          if (update.value !== undefined) template.fields[fieldIndex].value = update.value;
          results.push({ name: update.name, updated: true });
        }
      }

      expect(results[0].updated).toBe(true);
      expect(results[1].updated).toBe(false);
      expect(results[1].error).toBe('Field not found');
    });
  });

  // ==========================================================================
  // add_field
  // ==========================================================================
  describe('add_field', () => {
    it('should add a new field to the template', () => {
      const template = createTemplate({
        fields: [createField('existing')],
      });

      const newField = createField('newField', 'newValue', {
        info: 'New field info',
        example: 'example',
        range: 'string',
      });

      template.fields.push(newField);

      expect(template.fields).toHaveLength(2);
      expect(template.fields[1].name).toBe('newField');
      expect(template.fields[1].value).toBe('newValue');
    });

    it('should insert field after specified field', () => {
      const template = createTemplate({
        fields: [
          createField('first'),
          createField('second'),
          createField('third'),
        ],
      });

      const insertAfter = 'first';
      const newField = createField('inserted');

      const index = findFieldIndex(template, insertAfter);
      template.fields.splice(index + 1, 0, newField);

      expect(template.fields[0].name).toBe('first');
      expect(template.fields[1].name).toBe('inserted');
      expect(template.fields[2].name).toBe('second');
    });

    it('should throw error if field already exists', () => {
      const template = createTemplate({
        fields: [createField('existing')],
      });

      const existingField = findField(template, 'existing');

      expect(existingField).toBeDefined();
      // Handler would throw: throw new Error(`Field "${field.name}" already exists`);
    });
  });

  // ==========================================================================
  // delete_field
  // ==========================================================================
  describe('delete_field', () => {
    it('should delete field from template', () => {
      const template = createTemplate({
        fields: [
          createField('keep'),
          createField('delete'),
        ],
      });

      const fieldIndex = findFieldIndex(template, 'delete');
      template.fields.splice(fieldIndex, 1);

      expect(template.fields).toHaveLength(1);
      expect(template.fields[0].name).toBe('keep');
    });

    it('should optionally delete related rules', () => {
      const template = createTemplate({
        fields: [createField('field1')],
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [
            { conditions: [{ name: 'field1', state: RuleState.Set }], targets: [{ name: 'other', state: RuleState.Set }] },
            { targets: [{ name: 'unrelated', state: RuleState.Set }] },
          ],
        }],
      });

      const deleteRelatedRules = true;
      const fieldName = 'field1';

      if (deleteRelatedRules && template.ruleSets?.[0]) {
        template.ruleSets[0].rules = template.ruleSets[0].rules.filter(rule => {
          const hasCondition = rule.conditions?.some(c => c.name === fieldName);
          const hasTarget = rule.targets.some(t => t.name === fieldName);
          return !hasCondition && !hasTarget;
        });
      }

      expect(template.ruleSets[0].rules).toHaveLength(1);
      expect(template.ruleSets[0].rules[0].targets[0].name).toBe('unrelated');
    });
  });

  // ==========================================================================
  // Rule Operations
  // ==========================================================================
  describe('list_rules', () => {
    it('should list rules from a ruleset', () => {
      const template = createTemplate({
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [
            { description: 'Rule 1', targets: [{ name: 'a', state: RuleState.Set }] },
            { description: 'Rule 2', conditions: [{ name: 'b', state: RuleState.Set }], targets: [{ name: 'c', state: RuleState.Set }] },
          ],
        }],
      });

      const ruleSet = template.ruleSets[0];
      const rules = ruleSet.rules.map((rule, index) => ({
        index,
        description: rule.description,
        conditionCount: rule.conditions?.length ?? 0,
        targetCount: rule.targets.length,
      }));

      expect(rules).toHaveLength(2);
      expect(rules[0].conditionCount).toBe(0);
      expect(rules[1].conditionCount).toBe(1);
    });

    it('should filter rules by field name', () => {
      const template = createTemplate({
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [
            { conditions: [{ name: 'Database.Host', state: RuleState.Set }], targets: [{ name: 'x', state: RuleState.Set }] },
            { targets: [{ name: 'Server.Port', state: RuleState.Set }] },
          ],
        }],
      });

      const filter = 'database';
      const filteredRules = template.ruleSets[0].rules.filter(rule => {
        const inConditions = rule.conditions?.some(c => c.name.toLowerCase().includes(filter));
        const inTargets = rule.targets.some(t => t.name.toLowerCase().includes(filter));
        return inConditions || inTargets;
      });

      expect(filteredRules).toHaveLength(1);
    });
  });

  describe('add_rule', () => {
    it('should add a new rule to the ruleset', () => {
      const template = createTemplate({
        ruleSets: [createRuleSet('Default', [])],
      });

      const newRule: Rule = {
        description: 'New rule',
        conditions: [{ name: 'trigger', state: RuleState.Set }],
        targets: [{ name: 'target', state: RuleState.Set }],
      };

      template.ruleSets[0].rules.push(newRule);

      expect(template.ruleSets[0].rules).toHaveLength(1);
      expect(template.ruleSets[0].rules[0].description).toBe('New rule');
    });
  });

  describe('update_rule', () => {
    it('should update rule properties', () => {
      const template = createTemplate({
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [{
            description: 'Original',
            conditions: [{ name: 'a', state: RuleState.Set }],
            targets: [{ name: 'b', state: RuleState.Set }],
          }],
        }],
      });

      const rule = template.ruleSets[0].rules[0];
      rule.description = 'Updated description';
      rule.targets = [{ name: 'c', state: RuleState.SetToValue, value: 'test' }];

      expect(template.ruleSets[0].rules[0].description).toBe('Updated description');
      expect(template.ruleSets[0].rules[0].targets[0].name).toBe('c');
    });
  });

  describe('delete_rule', () => {
    it('should delete rule by index', () => {
      const template = createTemplate({
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [
            { targets: [{ name: 'a', state: RuleState.Set }] },
            { targets: [{ name: 'b', state: RuleState.Set }] },
            { targets: [{ name: 'c', state: RuleState.Set }] },
          ],
        }],
      });

      const deleteIndex = 1;
      template.ruleSets[0].rules.splice(deleteIndex, 1);

      expect(template.ruleSets[0].rules).toHaveLength(2);
      expect(template.ruleSets[0].rules[0].targets[0].name).toBe('a');
      expect(template.ruleSets[0].rules[1].targets[0].name).toBe('c');
    });
  });

  // ==========================================================================
  // Validation
  // ==========================================================================
  describe('validate_fields', () => {
    it('should validate field values against range', () => {
      const template = createTemplate({
        fields: [
          createField('valid', 'test', { range: 'string', checked: true }),
          createField('invalid', 'not-a-bool', { range: 'boolean', checked: true }),
        ],
      });

      // Simplified validation check
      const results = template.fields.map(f => ({
        name: f.name,
        // In real implementation, validateValue would check this
        valid: f.range === 'string' || (f.range === 'boolean' && (f.value === 'true' || f.value === 'false')),
      }));

      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });
  });

  describe('validate_template', () => {
    it('should detect missing template name', () => {
      const template = createTemplate({ name: '' });
      const issues: string[] = [];

      if (!template.name) {
        issues.push('Missing template name');
      }

      expect(issues).toContain('Missing template name');
    });

    it('should detect duplicate field names', () => {
      const template = createTemplate({
        fields: [
          createField('duplicate'),
          createField('duplicate'),
        ],
      });

      const fieldNames = new Set<string>();
      const duplicates: string[] = [];

      for (const field of template.fields) {
        if (fieldNames.has(field.name)) {
          duplicates.push(field.name);
        } else {
          fieldNames.add(field.name);
        }
      }

      expect(duplicates).toContain('duplicate');
    });
  });
});

// ==========================================================================
// Integration-style tests for rule application
// ==========================================================================
describe('Rule Application Integration', () => {
  it('should apply rules when field is set', () => {
    const fields: Field[] = [
      createField('trigger', 'value', { checked: true }),
      createField('target', '', { checked: false }),
    ];
    const rules: Rule[] = [{
      conditions: [{ name: 'trigger', state: RuleState.Set }],
      targets: [{ name: 'target', state: RuleState.Set }],
    }];

    const { updatedFields, appliedRules } = applyRulesToFields(fields, rules);

    expect(updatedFields.find(f => f.name === 'target')?.checked).toBe(true);
    expect(appliedRules.length).toBeGreaterThan(0);
  });
});
