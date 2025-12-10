import { describe, it, expect } from 'vitest';
import { applyRules, isFieldRequired } from '../utils/applyRules';
import { RuleState, Field, Rule } from '@guido/types';

describe('applyRules', () => {
  describe('Set state', () => {
    it('should enable field when condition is met', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'Target', value: '', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'Target', state: RuleState.Set }],
        },
      ];

      const result = applyRules(fields, rules);
      const target = result.updatedFields.find(f => f.name === 'Target');
      expect(target?.checked).toBe(true);
    });

    it('should disable field with not flag', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'Target', value: '', checked: true, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'Target', state: RuleState.Set, not: true }],
        },
      ];

      const result = applyRules(fields, rules);
      const target = result.updatedFields.find(f => f.name === 'Target');
      expect(target?.checked).toBe(false);
    });
  });

  describe('SetToValue state', () => {
    it('should set field value when condition is met', () => {
      const fields: Field[] = [
        { name: 'DatabaseType', value: 'SQL', checked: true, info: '', example: '', range: '' },
        { name: 'Port', value: '', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'DatabaseType', state: RuleState.SetToValue, value: 'SQL' }],
          targets: [{ name: 'Port', state: RuleState.SetToValue, value: '5432' }],
        },
      ];

      const result = applyRules(fields, rules);
      const port = result.updatedFields.find(f => f.name === 'Port');
      expect(port?.value).toBe('5432');
      expect(port?.checked).toBe(true);
    });

    it('should clear field value with not flag', () => {
      const fields: Field[] = [
        { name: 'DatabaseType', value: 'SQL', checked: true, info: '', example: '', range: '' },
        { name: 'Port', value: '5432', checked: true, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'DatabaseType', state: RuleState.SetToValue, value: 'SQL' }],
          targets: [{ name: 'Port', state: RuleState.SetToValue, value: '5432', not: true }],
        },
      ];

      const result = applyRules(fields, rules);
      const port = result.updatedFields.find(f => f.name === 'Port');
      expect(port?.value).toBe('');
      expect(port?.checked).toBe(false);
    });
  });

  describe('Contains state', () => {
    it('should add value to JSON array field', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'ArrayField', value: '["value1"]', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value2' }],
        },
      ];

      const result = applyRules(fields, rules);
      const arrayField = result.updatedFields.find(f => f.name === 'ArrayField');
      expect(arrayField?.value).toBe('["value1","value2"]');
      expect(arrayField?.checked).toBe(true);
    });

    it('should not add duplicate value to array', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'ArrayField', value: '["value1","value2"]', checked: true, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value2' }],
        },
      ];

      const result = applyRules(fields, rules);
      const arrayField = result.updatedFields.find(f => f.name === 'ArrayField');
      expect(arrayField?.value).toBe('["value1","value2"]');
    });

    it('should append to string field', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'StringField', value: 'hello', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'StringField', state: RuleState.Contains, value: 'world' }],
        },
      ];

      const result = applyRules(fields, rules);
      const stringField = result.updatedFields.find(f => f.name === 'StringField');
      expect(stringField?.value).toBe('hello world');
      expect(stringField?.checked).toBe(true);
    });

    it('should not append if substring already exists', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'StringField', value: 'hello world', checked: true, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'StringField', state: RuleState.Contains, value: 'world' }],
        },
      ];

      const result = applyRules(fields, rules);
      const stringField = result.updatedFields.find(f => f.name === 'StringField');
      expect(stringField?.value).toBe('hello world');
    });

    it('should handle empty string field', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'StringField', value: '', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'StringField', state: RuleState.Contains, value: 'hello' }],
        },
      ];

      const result = applyRules(fields, rules);
      const stringField = result.updatedFields.find(f => f.name === 'StringField');
      expect(stringField?.value).toBe('hello');
      expect(stringField?.checked).toBe(true);
    });

    it('should remove value from JSON array field with not flag', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'ArrayField', value: '["value1","value2","value3"]', checked: true, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value2', not: true }],
        },
      ];

      const result = applyRules(fields, rules);
      const arrayField = result.updatedFields.find(f => f.name === 'ArrayField');
      expect(arrayField?.value).toBe('["value1","value3"]');
    });

    it('should remove substring from string field with not flag', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'StringField', value: 'hello world today', checked: true, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'StringField', state: RuleState.Contains, value: 'world', not: true }],
        },
      ];

      const result = applyRules(fields, rules);
      const stringField = result.updatedFields.find(f => f.name === 'StringField');
      expect(stringField?.value).toBe('hello today');
    });

    it('should uncheck field when contains-not removes all values', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'ArrayField', value: '["value1"]', checked: true, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value1', not: true }],
        },
      ];

      const result = applyRules(fields, rules);
      const arrayField = result.updatedFields.find(f => f.name === 'ArrayField');
      expect(arrayField?.value).toBe('[]');
      expect(arrayField?.checked).toBe(false);
    });
  });

  describe('Condition checking', () => {
    it('should check contains condition for array', () => {
      const fields: Field[] = [
        { name: 'ArrayField', value: '["value1","value2"]', checked: true, info: '', example: '', range: '' },
        { name: 'Target', value: '', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value2' }],
          targets: [{ name: 'Target', state: RuleState.Set }],
        },
      ];

      const result = applyRules(fields, rules);
      const target = result.updatedFields.find(f => f.name === 'Target');
      expect(target?.checked).toBe(true);
    });

    it('should check contains condition for string', () => {
      const fields: Field[] = [
        { name: 'StringField', value: 'hello world', checked: true, info: '', example: '', range: '' },
        { name: 'Target', value: '', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'StringField', state: RuleState.Contains, value: 'world' }],
          targets: [{ name: 'Target', state: RuleState.Set }],
        },
      ];

      const result = applyRules(fields, rules);
      const target = result.updatedFields.find(f => f.name === 'Target');
      expect(target?.checked).toBe(true);
    });

    it('should not trigger if contains condition not met', () => {
      const fields: Field[] = [
        { name: 'StringField', value: 'hello', checked: true, info: '', example: '', range: '' },
        { name: 'Target', value: '', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'StringField', state: RuleState.Contains, value: 'world' }],
          targets: [{ name: 'Target', state: RuleState.Set }],
        },
      ];

      const result = applyRules(fields, rules);
      const target = result.updatedFields.find(f => f.name === 'Target');
      expect(target?.checked).toBe(false);
    });
  });

  describe('Child fields', () => {
    it('should apply rules to child fields', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'Parent.Child1', value: '', checked: false, info: '', example: '', range: '' },
        { name: 'Parent.Child2', value: '', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'Parent', state: RuleState.Set }],
        },
      ];

      const result = applyRules(fields, rules);
      const child1 = result.updatedFields.find(f => f.name === 'Parent.Child1');
      const child2 = result.updatedFields.find(f => f.name === 'Parent.Child2');
      expect(child1?.checked).toBe(true);
      expect(child2?.checked).toBe(true);
    });
  });

  describe('Disabled reasons', () => {
    it('should provide reason for disabled field', () => {
      const fields: Field[] = [
        { name: 'Condition', value: 'true', checked: true, info: '', example: '', range: '' },
        { name: 'Target', value: '', checked: false, info: '', example: '', range: '' },
      ];
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [{ name: 'Target', state: RuleState.Set }],
        },
      ];

      const result = applyRules(fields, rules);
      expect(result.disabledReasons['Target']).toBeDefined();
      expect(result.disabledReasons['Target']).toContain('Condition');
    });
  });
});

describe('isFieldRequired', () => {
  it('should return true for unconditional Set rule', () => {
    const rules: Rule[] = [
      {
        conditions: [],
        targets: [{ name: 'Field1', state: RuleState.Set }],
      },
    ];
    expect(isFieldRequired('Field1', rules)).toBe(true);
  });

  it('should return true for unconditional SetToValue rule', () => {
    const rules: Rule[] = [
      {
        conditions: [],
        targets: [{ name: 'Field1', state: RuleState.SetToValue, value: 'test' }],
      },
    ];
    expect(isFieldRequired('Field1', rules)).toBe(true);
  });

  it('should return true for unconditional Contains rule', () => {
    const rules: Rule[] = [
      {
        targets: [{ name: 'Field1', state: RuleState.Contains, value: 'test' }],
      } as Rule,
    ];
    expect(isFieldRequired('Field1', rules)).toBe(true);
  });

  it('should return false for conditional rule', () => {
    const rules: Rule[] = [
      {
        conditions: [{ name: 'Other', state: RuleState.Set }],
        targets: [{ name: 'Field1', state: RuleState.Set }],
      },
    ];
    expect(isFieldRequired('Field1', rules)).toBe(false);
  });

  it('should return false for non-matching field', () => {
    const rules: Rule[] = [
      {
        conditions: [],
        targets: [{ name: 'Field2', state: RuleState.Set }],
      },
    ];
    expect(isFieldRequired('Field1', rules)).toBe(false);
  });
});
