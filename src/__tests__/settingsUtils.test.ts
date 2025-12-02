import { describe, it, expect } from 'vitest';
import {
  flattenObject,
  updateFields,
  validateValue,
  generateParentPaths,
  hasEmptyProperty,
  prioritizeIncompleteFields,
  flattenNestedFields,
  hasNestedFields,
  normalizeTemplateFields,
  parseNaturalLanguageRule,
  translateRule,
  translateRangeToHumanReadable,
} from '@guido/core';
import { Field, NestedField, Template, RuleState } from '@guido/types';

describe('flattenObject', () => {
  it('should flatten simple nested object', () => {
    const obj = {
      a: {
        b: 'value',
      },
    };
    const result = flattenObject(obj);
    expect(result).toEqual({ 'a.b': 'value' });
  });

  it('should flatten deeply nested object', () => {
    const obj = {
      level1: {
        level2: {
          level3: 'deep',
        },
      },
    };
    const result = flattenObject(obj);
    expect(result).toEqual({ 'level1.level2.level3': 'deep' });
  });

  it('should handle arrays with objects', () => {
    const obj = {
      items: [
        { name: 'first' },
        { name: 'second' },
      ],
    };
    const result = flattenObject(obj);
    expect(result['items.1.name']).toBe('first');
    expect(result['items.2.name']).toBe('second');
  });

  it('should handle arrays with primitives', () => {
    const obj = {
      tags: ['a', 'b', 'c'],
    };
    const result = flattenObject(obj);
    expect(result['tags.1']).toBe('a');
    expect(result['tags.2']).toBe('b');
    expect(result['tags.3']).toBe('c');
  });

  it('should handle mixed content', () => {
    const obj = {
      name: 'test',
      config: {
        host: 'localhost',
        port: 8080,
      },
      enabled: true,
    };
    const result = flattenObject(obj);
    expect(result).toEqual({
      name: 'test',
      'config.host': 'localhost',
      'config.port': 8080,
      enabled: true,
    });
  });

  it('should handle empty object', () => {
    const result = flattenObject({});
    expect(result).toEqual({});
  });
});

describe('validateValue', () => {
  describe('string type', () => {
    it('should accept any string value', () => {
      expect(validateValue('anything', 'string')).toBe(true);
      expect(validateValue('', 'string')).toBe(true);
      expect(validateValue('123', 'string')).toBe(true);
    });
  });

  describe('boolean type', () => {
    it('should accept true/false strings', () => {
      expect(validateValue('true', 'boolean')).toBe(true);
      expect(validateValue('false', 'boolean')).toBe(true);
    });

    it('should reject non-boolean strings', () => {
      expect(validateValue('yes', 'boolean')).toBe(false);
      expect(validateValue('1', 'boolean')).toBe(false);
      expect(validateValue('', 'boolean')).toBe(false);
    });
  });

  describe('url type', () => {
    it('should accept valid URLs', () => {
      expect(validateValue('https://example.com', 'url')).toBe(true);
      expect(validateValue('http://localhost:8080/path', 'url')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateValue('not-a-url', 'url')).toBe(false);
      expect(validateValue('', 'url')).toBe(false);
    });
  });

  describe('integer type', () => {
    it('should accept integers', () => {
      expect(validateValue('123', 'integer')).toBe(true);
      expect(validateValue('0', 'integer')).toBe(true);
      expect(validateValue('-42', 'integer')).toBe(true);
    });

    it('should reject non-integers', () => {
      expect(validateValue('12.5', 'integer')).toBe(false);
      expect(validateValue('abc', 'integer')).toBe(false);
    });
  });

  describe('options (pipe-separated)', () => {
    it('should accept valid options with || separator', () => {
      expect(validateValue('red', 'red||green||blue')).toBe(true);
      expect(validateValue('green', 'red||green||blue')).toBe(true);
    });

    it('should reject invalid options with || separator', () => {
      expect(validateValue('yellow', 'red||green||blue')).toBe(false);
      expect(validateValue('', 'red||green||blue')).toBe(false);
    });

    // Legacy support for slash-separated
    it('should accept valid options with legacy / separator', () => {
      expect(validateValue('red', 'red / green / blue')).toBe(true);
      expect(validateValue('green', 'red / green / blue')).toBe(true);
    });

    it('should reject invalid options with legacy / separator', () => {
      expect(validateValue('yellow', 'red / green / blue')).toBe(false);
      expect(validateValue('', 'red / green / blue')).toBe(false);
    });
  });

  describe('array type', () => {
    it('should accept valid JSON arrays with string[] syntax', () => {
      expect(validateValue(['a', 'b'], 'string[]')).toBe(true);
      expect(validateValue(['single'], 'string[]')).toBe(true);
    });

    it('should accept valid integer arrays with integer[] syntax', () => {
      expect(validateValue([1, 2, 3], 'integer[]')).toBe(true);
    });

    it('should reject wrong item types', () => {
      expect(validateValue([1, 2], 'string[]')).toBe(false);
      expect(validateValue(['a', 'b'], 'integer[]')).toBe(false);
    });

    it('should validate array size constraints', () => {
      expect(validateValue(['a', 'b'], 'string[1..5]')).toBe(true);
      expect(validateValue(['a', 'b', 'c', 'd', 'e', 'f'], 'string[1..5]')).toBe(false); // too many
      expect(validateValue([], 'string[1..5]')).toBe(false); // too few
    });

    // String value that looks like JSON array should validate with string[] type
    it('should accept JSON array strings with string[] type', () => {
      expect(validateValue('["a", "b"]', 'string[]')).toBe(true);
      expect(validateValue('["single"]', 'string[]')).toBe(true);
    });

    it('should reject invalid arrays', () => {
      expect(validateValue('not an array', 'string[]')).toBe(false);
      expect(validateValue('[1, 2]', 'string[]')).toBe(false); // integers, not strings
    });
  });

  describe('bounded integer type', () => {
    it('should accept integers within range', () => {
      expect(validateValue(8080, 'integer(1..65535)')).toBe(true);
      expect(validateValue(1, 'integer(1..65535)')).toBe(true);
      expect(validateValue(65535, 'integer(1..65535)')).toBe(true);
    });

    it('should reject integers outside range', () => {
      expect(validateValue(0, 'integer(1..65535)')).toBe(false);
      expect(validateValue(70000, 'integer(1..65535)')).toBe(false);
    });

    it('should handle open-ended ranges', () => {
      expect(validateValue(100, 'integer(1..)')).toBe(true);
      expect(validateValue(0, 'integer(1..)')).toBe(false);
      expect(validateValue(-5, 'integer(..10)')).toBe(true);
      expect(validateValue(15, 'integer(..10)')).toBe(false);
    });
  });

  describe('bounded string type', () => {
    it('should accept strings within length range', () => {
      expect(validateValue('hello', 'string(1..10)')).toBe(true);
      expect(validateValue('a', 'string(1..10)')).toBe(true);
    });

    it('should reject strings outside length range', () => {
      expect(validateValue('', 'string(1..10)')).toBe(false); // too short
      expect(validateValue('this is way too long', 'string(1..10)')).toBe(false); // too long
    });
  });

  describe('regex pattern', () => {
    it('should validate against regex', () => {
      expect(validateValue('ABC', '^[A-Z]+$')).toBe(true);
      expect(validateValue('abc', '^[A-Z]+$')).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      expect(validateValue('test', '[invalid(')).toBe(false);
    });
  });
});

describe('updateFields', () => {
  it('should update existing field values', () => {
    const fields: Field[] = [
      { name: 'host', value: 'old', info: '', example: '', range: '' },
    ];
    const settings = { host: 'new-value' };

    const result = updateFields(fields, settings);

    expect(result[0].value).toBe('new-value');
    expect(result[0].checked).toBe(true);
  });

  it('should add new fields from settings', () => {
    const fields: Field[] = [
      { name: 'existing', value: 'val', info: '', example: '', range: '' },
    ];
    const settings = { existing: 'val', newField: 'new-val' };

    const result = updateFields(fields, settings);

    expect(result).toHaveLength(2);
    expect(result[1].name).toBe('newField');
    expect(result[1].value).toBe('new-val');
    expect(result[1].checked).toBe(true);
  });

  it('should preserve fields not in settings', () => {
    const fields: Field[] = [
      { name: 'unchanged', value: 'original', info: 'info', example: 'ex', range: 'string', checked: false },
    ];
    const settings = {};

    const result = updateFields(fields, settings);

    expect(result[0].value).toBe('original');
    expect(result[0].checked).toBe(false);
  });
});

describe('generateParentPaths', () => {
  it('should generate all parent paths', () => {
    const fieldNames = ['a.b.c', 'x.y'];
    const result = generateParentPaths(fieldNames);

    expect(result).toContain('a');
    expect(result).toContain('a.b');
    expect(result).toContain('a.b.c');
    expect(result).toContain('x');
    expect(result).toContain('x.y');
  });

  it('should handle single-level names', () => {
    const result = generateParentPaths(['simple']);
    expect(result).toEqual(['simple']);
  });

  it('should deduplicate paths', () => {
    const result = generateParentPaths(['a.b', 'a.c']);
    expect(result.filter(p => p === 'a')).toHaveLength(1);
  });
});

describe('hasEmptyProperty', () => {
  it('should detect empty info', () => {
    const field: Field = { name: 'f', value: 'v', info: '', example: 'ex', range: 'string' };
    expect(hasEmptyProperty(field)).toBe(true);
  });

  it('should detect empty example', () => {
    const field: Field = { name: 'f', value: 'v', info: 'info', example: '', range: 'string' };
    expect(hasEmptyProperty(field)).toBe(true);
  });

  it('should detect empty range', () => {
    const field: Field = { name: 'f', value: 'v', info: 'info', example: 'ex', range: '' };
    expect(hasEmptyProperty(field)).toBe(true);
  });

  it('should return false when all properties filled', () => {
    const field: Field = { name: 'f', value: 'v', info: 'info', example: 'ex', range: 'string' };
    expect(hasEmptyProperty(field)).toBe(false);
  });
});

describe('prioritizeIncompleteFields', () => {
  it('should put incomplete fields first', () => {
    const fields: Field[] = [
      { name: 'complete', value: '', info: 'i', example: 'e', range: 'r' },
      { name: 'incomplete', value: '', info: '', example: 'e', range: 'r' },
    ];

    const result = prioritizeIncompleteFields(fields);

    expect(result[0].name).toBe('incomplete');
    expect(result[1].name).toBe('complete');
  });

  it('should sort alphabetically within same completeness', () => {
    const fields: Field[] = [
      { name: 'zebra', value: '', info: '', example: '', range: '' },
      { name: 'alpha', value: '', info: '', example: '', range: '' },
    ];

    const result = prioritizeIncompleteFields(fields);

    expect(result[0].name).toBe('alpha');
    expect(result[1].name).toBe('zebra');
  });
});

describe('Nested field utilities', () => {
  describe('hasNestedFields', () => {
    it('should detect nested fields', () => {
      const fields: NestedField[] = [
        {
          name: 'parent',
          value: '',
          info: '',
          example: '',
          range: '',
          fields: [
            { name: 'child', value: 'val', info: '', example: '', range: '' },
          ],
        },
      ];
      expect(hasNestedFields(fields)).toBe(true);
    });

    it('should return false for flat fields', () => {
      const fields: Field[] = [
        { name: 'flat1', value: '', info: '', example: '', range: '' },
        { name: 'flat2', value: '', info: '', example: '', range: '' },
      ];
      expect(hasNestedFields(fields)).toBe(false);
    });

    it('should return false for empty fields array in nested', () => {
      const fields: NestedField[] = [
        { name: 'parent', value: '', info: '', example: '', range: '', fields: [] },
      ];
      expect(hasNestedFields(fields)).toBe(false);
    });
  });

  describe('flattenNestedFields', () => {
    it('should flatten simple nested structure', () => {
      const nested: NestedField[] = [
        {
          name: 'parent',
          value: '',
          info: '',
          example: '',
          range: '',
          fields: [
            { name: 'child', value: 'childVal', info: 'childInfo', example: '', range: '' },
          ],
        },
      ];

      const result = flattenNestedFields(nested);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('parent.child');
      expect(result[0].value).toBe('childVal');
      expect(result[0].info).toBe('childInfo');
    });

    it('should flatten deeply nested structure', () => {
      const nested: NestedField[] = [
        {
          name: 'a',
          value: '',
          info: '',
          example: '',
          range: '',
          fields: [
            {
              name: 'b',
              value: '',
              info: '',
              example: '',
              range: '',
              fields: [
                { name: 'c', value: 'deep', info: '', example: '', range: '' },
              ],
            },
          ],
        },
      ];

      const result = flattenNestedFields(nested);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('a.b.c');
      expect(result[0].value).toBe('deep');
    });

    it('should handle multiple siblings', () => {
      const nested: NestedField[] = [
        {
          name: 'config',
          value: '',
          info: '',
          example: '',
          range: '',
          fields: [
            { name: 'host', value: 'localhost', info: '', example: '', range: '' },
            { name: 'port', value: '8080', info: '', example: '', range: '' },
          ],
        },
      ];

      const result = flattenNestedFields(nested);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('config.host');
      expect(result[1].name).toBe('config.port');
    });

    it('should use custom separator', () => {
      const nested: NestedField[] = [
        {
          name: 'a',
          value: '',
          info: '',
          example: '',
          range: '',
          fields: [
            { name: 'b', value: 'val', info: '', example: '', range: '' },
          ],
        },
      ];

      const result = flattenNestedFields(nested, ':');

      expect(result[0].name).toBe('a:b');
    });

    it('should convert options to range', () => {
      const nested: NestedField[] = [
        {
          name: 'level',
          value: 'info',
          info: '',
          example: '',
          range: '',
          options: ['debug', 'info', 'warn', 'error'],
        },
      ];

      const result = flattenNestedFields(nested);

      expect(result[0].range).toBe('debug / info / warn / error');
    });

    it('should preserve existing range over options', () => {
      const nested: NestedField[] = [
        {
          name: 'field',
          value: '',
          info: '',
          example: '',
          range: 'custom range',
          options: ['a', 'b'],
        },
      ];

      const result = flattenNestedFields(nested);

      expect(result[0].range).toBe('custom range');
    });
  });

  describe('normalizeTemplateFields', () => {
    it('should normalize template with nested fields', () => {
      const template: Template = {
        name: 'Test',
        version: '1.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          {
            name: 'root',
            value: '',
            info: '',
            example: '',
            range: '',
            fields: [
              { name: 'leaf', value: 'val', info: '', example: '', range: '' },
            ],
          } as NestedField,
        ],
        ruleSets: [],
      };

      const result = normalizeTemplateFields(template);

      expect(result.fields).toHaveLength(1);
      expect(result.fields[0].name).toBe('root.leaf');
    });

    it('should pass through already-flat template', () => {
      const template: Template = {
        name: 'Flat',
        version: '1.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'flat.field', value: 'val', info: '', example: '', range: '' },
        ],
        ruleSets: [],
      };

      const result = normalizeTemplateFields(template);

      expect(result).toBe(template); // Same reference - no transformation
    });
  });
});

describe('parseNaturalLanguageRule', () => {
  describe('if-then patterns', () => {
    it('should parse "if X is set, then Y is set"', () => {
      const rule = parseNaturalLanguageRule('If FeatureA is set, then FeatureB is set');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions).toHaveLength(1);
      expect(rule!.conditions![0].name).toBe('FeatureA');
      expect(rule!.conditions![0].state).toBe(RuleState.Set);
      expect(rule!.targets).toHaveLength(1);
      expect(rule!.targets[0].name).toBe('FeatureB');
      expect(rule!.targets[0].state).toBe(RuleState.Set);
    });

    it('should parse "if X = value, then Y = value"', () => {
      const rule = parseNaturalLanguageRule('If Mode = Advanced, then ShowOptions = true');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions![0].name).toBe('Mode');
      expect(rule!.conditions![0].state).toBe(RuleState.SetToValue);
      expect(rule!.conditions![0].value).toBe('Advanced');
      expect(rule!.targets[0].name).toBe('ShowOptions');
      expect(rule!.targets[0].state).toBe(RuleState.SetToValue);
      expect(rule!.targets[0].value).toBe('true');
    });

    it('should parse "if X is set to value then Y is set to value"', () => {
      const rule = parseNaturalLanguageRule('If Logging.Level is set to Debug then Logging.Verbose is set to true');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions![0].name).toBe('Logging.Level');
      expect(rule!.conditions![0].state).toBe(RuleState.SetToValue);
      expect(rule!.conditions![0].value).toBe('Debug');
    });

    it('should parse "when X contains value, then Y is set"', () => {
      const rule = parseNaturalLanguageRule('When Tags contains admin, then AdminPanel is set');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions![0].name).toBe('Tags');
      expect(rule!.conditions![0].state).toBe(RuleState.Contains);
      expect(rule!.conditions![0].value).toBe('admin');
    });

    it('should parse multiple conditions with "and"', () => {
      const rule = parseNaturalLanguageRule('If FeatureA is set and FeatureB is set, then FeatureC is set');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions).toHaveLength(2);
      expect(rule!.conditions![0].name).toBe('FeatureA');
      expect(rule!.conditions![1].name).toBe('FeatureB');
    });

    it('should parse multiple targets with "and"', () => {
      const rule = parseNaturalLanguageRule('If Master is set, then SlaveA is set and SlaveB is set');
      
      expect(rule).not.toBeNull();
      expect(rule!.targets).toHaveLength(2);
      expect(rule!.targets[0].name).toBe('SlaveA');
      expect(rule!.targets[1].name).toBe('SlaveB');
    });
  });

  describe('negation patterns', () => {
    it('should parse "if X is not set, then Y is not set"', () => {
      const rule = parseNaturalLanguageRule('If Feature is not set, then Dependency is not set');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions![0].not).toBe(true);
      expect(rule!.targets[0].not).toBe(true);
    });

    it('should parse "if X is disabled, then Y is disabled"', () => {
      const rule = parseNaturalLanguageRule('If Premium disabled, then AdvancedFeatures disabled');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions![0].not).toBe(true);
      expect(rule!.targets[0].not).toBe(true);
    });
  });

  describe('requires/depends patterns', () => {
    it('should parse "X requires Y"', () => {
      const rule = parseNaturalLanguageRule('Database requires ConnectionString');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions).toHaveLength(1);
      expect(rule!.conditions![0].name).toBe('Database');
      expect(rule!.targets[0].name).toBe('ConnectionString');
    });

    it('should parse "Y depends on X"', () => {
      const rule = parseNaturalLanguageRule('Caching depends on Redis');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions![0].name).toBe('Redis');
      expect(rule!.targets[0].name).toBe('Caching');
    });
  });

  describe('unconditional patterns', () => {
    it('should parse "Always set X"', () => {
      const rule = parseNaturalLanguageRule('Always set Logging.Enabled');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions).toBeUndefined();
      expect(rule!.targets).toHaveLength(1);
      expect(rule!.targets[0].name).toBe('Logging.Enabled');
    });

    it('should parse "X is always required"', () => {
      const rule = parseNaturalLanguageRule('ConnectionString is always required');
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions).toBeUndefined();
      expect(rule!.targets[0].name).toBe('ConnectionString');
    });
  });

  describe('field name matching', () => {
    it('should match field names case-insensitively', () => {
      const fieldNames = ['Logging.Level', 'Database.Host'];
      const rule = parseNaturalLanguageRule('If logging.level is set then database.host is set', fieldNames);
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions![0].name).toBe('Logging.Level');
      expect(rule!.targets[0].name).toBe('Database.Host');
    });

    it('should handle quoted field names', () => {
      const rule = parseNaturalLanguageRule("If 'Config.Setting' is set, then 'Other.Setting' is set");
      
      expect(rule).not.toBeNull();
      expect(rule!.conditions![0].name).toBe('Config.Setting');
      expect(rule!.targets[0].name).toBe('Other.Setting');
    });
  });

  describe('round-trip: translate -> parse', () => {
    it('should parse back what translateRule produces (simple)', () => {
      const original = {
        conditions: [{ name: 'FieldA', state: RuleState.Set, not: false }],
        targets: [{ name: 'FieldB', state: RuleState.Set, not: false }],
      };
      
      const translated = translateRule(original);
      // translateRule outputs: "If 'FieldA' is set, then 'FieldB' is required to be set."
      
      const parsed = parseNaturalLanguageRule(translated);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.conditions![0].name).toBe('FieldA');
      expect(parsed!.conditions![0].state).toBe(RuleState.Set);
      expect(parsed!.targets[0].name).toBe('FieldB');
      expect(parsed!.targets[0].state).toBe(RuleState.Set);
    });

    it('should parse back what translateRule produces (set_to_value)', () => {
      const original = {
        conditions: [{ name: 'Mode', state: RuleState.SetToValue, value: 'Advanced', not: false }],
        targets: [{ name: 'Features', state: RuleState.SetToValue, value: 'Full', not: false }],
      };
      
      const translated = translateRule(original);
      const parsed = parseNaturalLanguageRule(translated);
      
      expect(parsed).not.toBeNull();
      expect(parsed!.conditions![0].state).toBe(RuleState.SetToValue);
      expect(parsed!.conditions![0].value).toBe('Advanced');
    });
  });

  describe('error handling', () => {
    it('should return null for unparseable input', () => {
      expect(parseNaturalLanguageRule('this is not a rule')).toBeNull();
      expect(parseNaturalLanguageRule('')).toBeNull();
      expect(parseNaturalLanguageRule('random text without structure')).toBeNull();
    });
  });
});

describe('translateRangeToHumanReadable', () => {
  describe('scalar types', () => {
    it('should translate basic string type', () => {
      expect(translateRangeToHumanReadable('string')).toBe('Any text');
    });

    it('should translate boolean type', () => {
      expect(translateRangeToHumanReadable('boolean')).toBe('Yes or No (true/false)');
    });

    it('should translate url type', () => {
      expect(translateRangeToHumanReadable('url')).toBe('A valid web address (URL)');
    });

    it('should translate basic integer type', () => {
      expect(translateRangeToHumanReadable('integer')).toBe('A whole number');
    });

    it('should translate bounded integer', () => {
      expect(translateRangeToHumanReadable('integer(1..100)')).toBe('A whole number between 1 and 100');
    });

    it('should translate integer with minimum only', () => {
      expect(translateRangeToHumanReadable('integer(1..)')).toBe('A whole number of 1 or more');
    });

    it('should translate integer with maximum only', () => {
      expect(translateRangeToHumanReadable('integer(..100)')).toBe('A whole number up to 100');
    });

    it('should translate bounded string length', () => {
      expect(translateRangeToHumanReadable('string(1..255)')).toBe('Text between 1 and 255 characters');
    });

    it('should translate string with minimum length', () => {
      expect(translateRangeToHumanReadable('string(5..)')).toBe('Text with at least 5 characters');
    });

    it('should translate string with maximum length', () => {
      expect(translateRangeToHumanReadable('string(..100)')).toBe('Text with up to 100 characters');
    });

    it('should translate string with exact length', () => {
      expect(translateRangeToHumanReadable('string(10..10)')).toBe('Text with exactly 10 characters');
    });
  });

  describe('array types', () => {
    it('should translate simple string array', () => {
      expect(translateRangeToHumanReadable('string[]')).toBe('A list of text values');
    });

    it('should translate simple integer array', () => {
      expect(translateRangeToHumanReadable('integer[]')).toBe('A list of whole numbers');
    });

    it('should translate bounded string array', () => {
      expect(translateRangeToHumanReadable('string[1..10]')).toBe('A list of 1 to 10 text values');
    });

    it('should translate array with exact size', () => {
      expect(translateRangeToHumanReadable('string[3..3]')).toBe('A list of exactly 3 text values');
    });

    it('should translate array with minimum size', () => {
      expect(translateRangeToHumanReadable('string[1..]')).toBe('A list of at least 1 text values');
    });

    it('should translate array with maximum size', () => {
      expect(translateRangeToHumanReadable('string[..5]')).toBe('A list of up to 5 text values');
    });
  });

  describe('enum types', () => {
    it('should translate two options', () => {
      expect(translateRangeToHumanReadable('debug||info')).toBe('Either "debug" or "info"');
    });

    it('should translate multiple options', () => {
      expect(translateRangeToHumanReadable('debug||info||warn||error')).toBe('One of: debug, info, warn, error');
    });

    it('should translate single option', () => {
      expect(translateRangeToHumanReadable('only')).toBe('Text matching a specific format');
    });

    it('should handle many options with truncation', () => {
      const result = translateRangeToHumanReadable('a||b||c||d||e||f||g');
      expect(result).toContain('One of:');
      expect(result).toContain('7 options');
    });

    it('should translate legacy enum syntax', () => {
      expect(translateRangeToHumanReadable('debug / info / warn')).toBe('One of: debug, info, warn');
    });
  });

  describe('pattern types', () => {
    it('should translate known letter pattern', () => {
      expect(translateRangeToHumanReadable('^[A-Z]{3}$')).toBe('Letters only');
    });
    
    it('should translate unknown patterns generically', () => {
      // A truly complex pattern that doesn't match any known pattern
      expect(translateRangeToHumanReadable('^(?=.*[0-9])(?=.*[!@#$%^&*]).*$')).toBe('Text matching a specific format');
    });
  });

  describe('edge cases', () => {
    it('should handle empty range', () => {
      expect(translateRangeToHumanReadable('')).toBe('Any value');
    });

    it('should handle whitespace-only range', () => {
      expect(translateRangeToHumanReadable('   ')).toBe('Any value');
    });
  });
});
