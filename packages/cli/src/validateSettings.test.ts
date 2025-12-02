import { describe, it, expect } from 'vitest';
import type { Template, FieldValue, Field } from '@guido/types';
import { RuleState } from '@guido/types';
import { 
  flattenObject, 
  toFieldValues, 
  parseKeyValueFormat,
  validateValue,
  mergeSettingsIntoFields,
  fieldsToNestedObject
} from '@guido/core';

describe('validateSettings CLI logic', () => {
  const mockTemplate: Template = {
    name: 'Test Template',
    fileName: 'test.json',
    version: '1.0.0',
    description: 'Test template for validation',
    owner: 'test',
    fields: [
      { name: 'server.port', value: 8080, info: 'Server port', example: '8080', range: 'integer(1..65535)', checked: true },
      { name: 'server.host', value: 'localhost', info: 'Server host', example: 'localhost', range: 'string', checked: true },
      { name: 'database.connection', value: '', info: 'Database connection string', example: 'mongodb://localhost', range: 'url', checked: false },
      { name: 'feature.enabled', value: false, info: 'Enable feature', example: 'true', range: 'boolean', checked: true },
      { name: 'tags', value: [], info: 'Tags', example: 'tag1,tag2', range: 'string[]', checked: false },
      { name: 'log.level', value: 'info', info: 'Log level', example: 'debug', range: 'debug||info||warn||error', checked: true },
    ],
    ruleSets: [
      {
        name: 'Default',
        description: 'Default ruleset',
        tags: [],
        rules: [
          {
            description: 'Enable database connection when server is set',
            conditions: [{ name: 'server.host', state: RuleState.Set }],
            targets: [{ name: 'database.connection', state: RuleState.Set }],
          },
        ],
      },
    ],
  };

  // Note: flattenObject and validateValue tests are in src/__tests__/settingsUtils.test.ts
  // This file focuses on CLI-specific integration scenarios

  describe('parseKeyValueFormat - properties/env parsing', () => {
    it('should parse properties file format', () => {
      const content = `
server.port=8080
server.host=localhost
# This is a comment
feature.enabled=true
      `.trim();

      const parsed = parseKeyValueFormat(content);
      expect(parsed['server.port']).toBe('8080');
      expect(parsed['server.host']).toBe('localhost');
      expect(parsed['feature.enabled']).toBe('true');
      // Comments should not appear in output
      expect(Object.keys(parsed)).not.toContain('#');
    });

    it('should handle quoted values', () => {
      const content = `
path="/usr/local/bin"
name='single quoted'
unquoted=no quotes here
      `.trim();

      const parsed = parseKeyValueFormat(content);
      expect(parsed['path']).toBe('/usr/local/bin');
      expect(parsed['name']).toBe('single quoted');
      expect(parsed['unquoted']).toBe('no quotes here');
    });

    it('should handle values with equals signs', () => {
      const content = `
url=https://example.com?foo=bar&baz=qux
      `.trim();

      const parsed = parseKeyValueFormat(content);
      expect(parsed['url']).toBe('https://example.com?foo=bar&baz=qux');
    });

    it('should ignore empty lines and comment lines', () => {
      const content = `
# Comment at start
key1=value1

# Another comment
key2=value2
// C-style comment
key3=value3
      `.trim();

      const parsed = parseKeyValueFormat(content);
      expect(Object.keys(parsed)).toHaveLength(3);
      expect(parsed['key1']).toBe('value1');
    });
  });

  // Note: validateValue tests are in src/__tests__/settingsUtils.test.ts with comprehensive coverage

  describe('mergeSettingsIntoFields - settings merge', () => {
    it('should update existing field values from settings', () => {
      const templateFields = mockTemplate.fields;
      const settings: Record<string, FieldValue> = {
        'server.port': 9000,
        'server.host': 'example.com',
      };

      const merged = mergeSettingsIntoFields(templateFields, settings);
      const portField = merged.find(f => f.name === 'server.port');
      const hostField = merged.find(f => f.name === 'server.host');

      expect(portField?.value).toBe(9000);
      expect(hostField?.value).toBe('example.com');
    });

    it('should add new fields from settings not in template', () => {
      const templateFields = mockTemplate.fields;
      const settings: Record<string, FieldValue> = {
        'custom.new.field': 'new value',
      };

      const merged = mergeSettingsIntoFields(templateFields, settings);
      const newField = merged.find(f => f.name === 'custom.new.field');

      expect(newField).toBeDefined();
      expect(newField?.value).toBe('new value');
      expect(newField?.checked).toBe(true);
    });

    it('should mark merged fields as checked', () => {
      const templateFields: Field[] = [
        { name: 'field1', value: '', info: '', example: '', range: 'string', checked: false },
      ];
      const settings: Record<string, FieldValue> = {
        'field1': 'updated',
      };

      const merged = mergeSettingsIntoFields(templateFields, settings);
      expect(merged[0].checked).toBe(true);
    });
  });

  describe('fieldsToNestedObject - field serialization', () => {
    it('should convert flat fields to nested object', () => {
      const fields: Field[] = [
        { name: 'server.port', value: 8080, info: '', example: '', range: 'integer', checked: true },
        { name: 'server.host', value: 'localhost', info: '', example: '', range: 'string', checked: true },
      ];

      const nested = fieldsToNestedObject(fields);
      expect(nested).toEqual({
        server: {
          port: 8080,
          host: 'localhost',
        },
      });
    });

    it('should only include checked fields', () => {
      const fields: Field[] = [
        { name: 'included', value: 'yes', info: '', example: '', range: 'string', checked: true },
        { name: 'excluded', value: 'no', info: '', example: '', range: 'string', checked: false },
      ];

      const nested = fieldsToNestedObject(fields);
      expect(nested).toHaveProperty('included');
      expect(nested).not.toHaveProperty('excluded');
    });
  });

  describe('settings and template validation integration', () => {
    it('should identify missing required fields using mergeSettingsIntoFields', () => {
      const templateFields = mockTemplate.fields;
      const settings: Record<string, FieldValue> = {
        'server.port': 8080,
        // server.host is missing but required (checked: true)
      };

      // Use the actual function to merge
      const merged = mergeSettingsIntoFields(templateFields, settings);
      
      // Find required fields still missing values
      const missingRequired = merged.filter(f => 
        f.checked && (f.value === '' || f.value === undefined || f.value === null)
      );

      // server.host, feature.enabled, log.level are required but weren't in settings
      expect(missingRequired.length).toBeGreaterThan(0);
    });

    it('should batch validate all fields with validateValue', () => {
      const settings: Record<string, FieldValue> = {
        'server.port': 99999, // Invalid: out of range 1..65535
        'server.host': 'localhost', // Valid
        'log.level': 'invalid', // Invalid: not in enum
        'feature.enabled': true, // Valid
      };

      const validationResults = mockTemplate.fields
        .filter(field => field.name in settings)
        .map(field => ({
          name: field.name,
          isValid: validateValue(settings[field.name], field.range),
        }));

      expect(validationResults.find(r => r.name === 'server.port')?.isValid).toBe(false);
      expect(validationResults.find(r => r.name === 'server.host')?.isValid).toBe(true);
      expect(validationResults.find(r => r.name === 'log.level')?.isValid).toBe(false);
      expect(validationResults.find(r => r.name === 'feature.enabled')?.isValid).toBe(true);
    });

    it('should round-trip settings through flatten and nest', () => {
      const original = {
        server: { port: 8080, host: 'localhost' },
        feature: { enabled: true },
      };
      
      const flattened = flattenObject(original);
      
      // Create fields from flattened data
      const fields: Field[] = Object.entries(flattened).map(([name, value]) => ({
        name,
        value: value as FieldValue,
        info: '',
        example: '',
        range: 'string',
        checked: true,
      }));
      
      // Convert back to nested
      const nested = fieldsToNestedObject(fields) as {
        server: { port: number; host: string };
        feature: { enabled: boolean };
      };
      
      expect(nested.server.port).toBe(8080);
      expect(nested.server.host).toBe('localhost');
      expect(nested.feature.enabled).toBe(true);
    });
  });

  describe('toFieldValues - type conversion', () => {
    it('should preserve string, number, boolean types', () => {
      const obj = {
        str: 'hello',
        num: 42,
        bool: true,
      };

      const result = toFieldValues(obj);
      expect(result.str).toBe('hello');
      expect(result.num).toBe(42);
      expect(result.bool).toBe(true);
    });

    it('should handle arrays', () => {
      const obj = {
        tags: ['a', 'b', 'c'],
        numbers: [1, 2, 3],
      };

      const result = toFieldValues(obj);
      expect(result.tags).toEqual(['a', 'b', 'c']);
      expect(result.numbers).toEqual([1, 2, 3]);
    });

    it('should convert undefined to empty string', () => {
      const obj: Record<string, unknown> = {
        defined: 'value',
        undef: undefined,
      };

      const result = toFieldValues(obj);
      expect(result.defined).toBe('value');
      expect(result.undef).toBe('');
    });
  });
});
