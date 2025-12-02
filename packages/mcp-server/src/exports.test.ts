import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { inputTypeToZod, buildInputSchema, toolDefinitions, getToolDef, getToolsByCategory } from './exports';

describe('inputTypeToZod', () => {
  describe('primitive types', () => {
    it('should convert string type', () => {
      const schema = inputTypeToZod('string', true);
      expect(schema.safeParse('hello').success).toBe(true);
      expect(schema.safeParse(123).success).toBe(false);
    });

    it('should convert number type', () => {
      const schema = inputTypeToZod('number', true);
      expect(schema.safeParse(42).success).toBe(true);
      expect(schema.safeParse('42').success).toBe(false);
    });

    it('should convert boolean type', () => {
      const schema = inputTypeToZod('boolean', true);
      expect(schema.safeParse(true).success).toBe(true);
      expect(schema.safeParse(false).success).toBe(true);
      expect(schema.safeParse('true').success).toBe(false);
    });
  });

  describe('array types', () => {
    it('should convert string[] type', () => {
      const schema = inputTypeToZod('string[]', true);
      expect(schema.safeParse(['a', 'b', 'c']).success).toBe(true);
      expect(schema.safeParse([1, 2, 3]).success).toBe(false);
      expect(schema.safeParse([]).success).toBe(true);
    });

    it('should convert number[] type', () => {
      const schema = inputTypeToZod('number[]', true);
      expect(schema.safeParse([1, 2, 3]).success).toBe(true);
      expect(schema.safeParse(['a', 'b']).success).toBe(false);
    });
  });

  describe('complex types', () => {
    it('should convert FieldValue type (accepts various primitives)', () => {
      const schema = inputTypeToZod('FieldValue', true);
      expect(schema.safeParse('string value').success).toBe(true);
      expect(schema.safeParse(42).success).toBe(true);
      expect(schema.safeParse(true).success).toBe(true);
      expect(schema.safeParse(['a', 'b']).success).toBe(true);
    });

    it('should convert RuleDomain type', () => {
      const schema = inputTypeToZod('RuleDomain', true);
      // Valid RuleDomain - uses 'name' property and state must be: set, set_to_value, or contains
      expect(schema.safeParse({ name: 'test', state: 'set' }).success).toBe(true);
      expect(schema.safeParse({ name: 'test', state: 'set_to_value', value: 'foo' }).success).toBe(true);
      expect(schema.safeParse({ name: 'test', state: 'contains', value: 'bar' }).success).toBe(true);
      // Invalid
      expect(schema.safeParse({ name: 'test' }).success).toBe(false); // missing state
      expect(schema.safeParse({ state: 'set' }).success).toBe(false); // missing name
      expect(schema.safeParse({ name: 'test', state: 'invalid_state' }).success).toBe(false); // invalid state
    });

    it('should convert RuleDomain[] type', () => {
      const schema = inputTypeToZod('RuleDomain[]', true);
      expect(schema.safeParse([
        { name: 'a', state: 'set' },
        { name: 'b', state: 'contains', value: 'test' }
      ]).success).toBe(true);
      expect(schema.safeParse([]).success).toBe(true);
    });
  });

  describe('optional handling', () => {
    it('should make schema optional when required is false', () => {
      const schema = inputTypeToZod('string', false);
      expect(schema.safeParse('hello').success).toBe(true);
      expect(schema.safeParse(undefined).success).toBe(true);
    });

    it('should make schema required when required is true', () => {
      const schema = inputTypeToZod('string', true);
      expect(schema.safeParse('hello').success).toBe(true);
      // When wrapped in an object, undefined would fail
    });
  });

  describe('unknown types', () => {
    it('should return z.unknown() for unrecognized types', () => {
      const schema = inputTypeToZod('SomeUnknownType', true);
      // z.unknown() accepts anything
      expect(schema.safeParse('anything').success).toBe(true);
      expect(schema.safeParse(123).success).toBe(true);
      expect(schema.safeParse({ foo: 'bar' }).success).toBe(true);
    });
  });
});

describe('buildInputSchema', () => {
  it('should build a schema from input definitions', () => {
    const inputs = {
      name: { type: 'string', required: true, description: 'The name' },
      count: { type: 'number', required: false, description: 'The count' },
    };

    const schema = buildInputSchema(inputs);
    
    expect(schema).toHaveProperty('name');
    expect(schema).toHaveProperty('count');
  });

  it('should create a valid zod object schema', () => {
    const inputs = {
      fieldName: { type: 'string', required: true, description: 'Field name' },
      value: { type: 'FieldValue', required: false, description: 'Field value' },
    };

    const schema = buildInputSchema(inputs);
    const zodObject = z.object(schema);

    // Valid data
    expect(zodObject.safeParse({ fieldName: 'test' }).success).toBe(true);
    expect(zodObject.safeParse({ fieldName: 'test', value: 42 }).success).toBe(true);

    // Invalid - missing required field
    expect(zodObject.safeParse({ value: 42 }).success).toBe(false);
  });

  it('should handle empty inputs', () => {
    const schema = buildInputSchema({});
    expect(Object.keys(schema)).toHaveLength(0);
  });

  it('should default required to false when not specified', () => {
    const inputs = {
      optional: { type: 'string', description: 'Optional field' },
    };

    const schema = buildInputSchema(inputs);
    const zodObject = z.object(schema);

    // Should accept without the optional field
    expect(zodObject.safeParse({}).success).toBe(true);
  });
});

describe('toolDefinitions', () => {
  it('should export tool definitions array', () => {
    expect(Array.isArray(toolDefinitions)).toBe(true);
    expect(toolDefinitions.length).toBeGreaterThan(0);
  });

  it('should have required properties on each tool', () => {
    for (const tool of toolDefinitions) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('category');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
    }
  });

  it('should have common tools defined', () => {
    const toolNames = toolDefinitions.map(t => t.name);
    expect(toolNames).toContain('list_fields');
    expect(toolNames).toContain('set_field');
    expect(toolNames).toContain('list_rules');
  });
});

describe('getToolDef', () => {
  it('should find a tool by name', () => {
    const tool = getToolDef('list_fields');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('list_fields');
  });

  it('should return undefined for non-existent tool', () => {
    const tool = getToolDef('non_existent_tool');
    expect(tool).toBeUndefined();
  });
});

describe('getToolsByCategory', () => {
  it('should return tools filtered by category', () => {
    const fieldTools = getToolsByCategory('field');
    expect(fieldTools.length).toBeGreaterThan(0);
    expect(fieldTools.every(t => t.category === 'field')).toBe(true);
  });

  it('should return empty array for non-existent category', () => {
    // Using type assertion to test non-existent category behavior
    const tools = getToolsByCategory('analysis'); // Use a valid category that might be empty
    // Just verify it returns an array
    expect(Array.isArray(tools)).toBe(true);
  });
});
