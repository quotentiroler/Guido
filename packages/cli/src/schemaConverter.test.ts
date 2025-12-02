import { describe, it, expect } from 'vitest';
import { jsonSchemaToGuido } from './schemaToGuido';
import { guidoToJsonSchema } from './guidoToSchema';
import type { Template, Field, Rule, RuleDomain } from '@guido/types';
import { RuleState } from '@guido/types';

/**
 * JSON Schema type for testing
 */
interface JSONSchema {
  $schema?: string;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  title?: string;
  description?: string;
  type?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: (string | number | boolean)[];
  const?: unknown;
  default?: unknown;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  dependentRequired?: Record<string, string[]>;
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
}

/**
 * Helper to validate a field has the correct Guido Field structure
 * (FLAT format: name, value, info, example, range)
 */
function assertValidGuidoField(field: unknown): asserts field is Field {
  expect(field).toBeDefined();
  expect(typeof field).toBe('object');
  
  const f = field as Record<string, unknown>;
  
  // Required properties must exist and be strings
  expect(typeof f.name).toBe('string');
  expect(typeof f.value).toBe('string');
  expect(typeof f.info).toBe('string');
  expect(typeof f.example).toBe('string');
  expect(typeof f.range).toBe('string');
  
  // Fields should NOT have nested 'fields' property (that's NestedField, not Field)
  expect(f.fields).toBeUndefined();
  
  // Optional properties if present must be correct type
  if (f.link !== undefined) {
    expect(typeof f.link).toBe('string');
  }
  if (f.checked !== undefined) {
    expect(typeof f.checked).toBe('boolean');
  }
}

/**
 * Helper to validate a RuleDomain has the correct structure
 */
function assertValidRuleDomain(domain: unknown): asserts domain is RuleDomain {
  expect(domain).toBeDefined();
  expect(typeof domain).toBe('object');
  
  const d = domain as Record<string, unknown>;
  
  // Required properties
  expect(typeof d.name).toBe('string');
  expect(Object.values(RuleState)).toContain(d.state);
  
  // Optional properties
  if (d.value !== undefined) {
    expect(typeof d.value).toBe('string');
  }
  if (d.not !== undefined) {
    expect(typeof d.not).toBe('boolean');
  }
}

/**
 * Helper to validate a Rule has the correct Guido Rule structure
 */
function assertValidGuidoRule(rule: unknown): asserts rule is Rule {
  expect(rule).toBeDefined();
  expect(typeof rule).toBe('object');
  
  const r = rule as Record<string, unknown>;
  
  // targets is required and must be an array of RuleDomain
  expect(Array.isArray(r.targets)).toBe(true);
  expect((r.targets as unknown[]).length).toBeGreaterThan(0);
  for (const target of r.targets as unknown[]) {
    assertValidRuleDomain(target);
  }
  
  // conditions is optional, but if present must be array of RuleDomain
  if (r.conditions !== undefined) {
    expect(Array.isArray(r.conditions)).toBe(true);
    for (const cond of r.conditions as unknown[]) {
      assertValidRuleDomain(cond);
    }
  }
  
  // Rules should NOT have these wrong properties (from old incorrect format)
  expect(r.id).toBeUndefined();
  expect(r.action).toBeUndefined();
  expect(r.targetFields).toBeUndefined();
  expect(r.description).toBeUndefined();
}

/**
 * Helper to validate a RuleSet has the correct structure
 */
function assertValidGuidoRuleSet(ruleSet: unknown): asserts ruleSet is { name: string; rules: Rule[] } {
  expect(ruleSet).toBeDefined();
  expect(typeof ruleSet).toBe('object');
  
  const rs = ruleSet as Record<string, unknown>;
  
  // Required properties
  expect(typeof rs.name).toBe('string');
  expect(Array.isArray(rs.rules)).toBe(true);
  
  // Validate each rule in the ruleset
  for (const rule of rs.rules as unknown[]) {
    assertValidGuidoRule(rule);
  }
  
  // Optional properties if present must be correct type
  if (rs.description !== undefined) {
    expect(typeof rs.description).toBe('string');
  }
  if (rs.tags !== undefined) {
    expect(Array.isArray(rs.tags)).toBe(true);
  }
  if (rs.enabled !== undefined) {
    expect(typeof rs.enabled).toBe('boolean');
  }
}

/**
 * Helper to validate a Template has the correct structure
 */
function assertValidGuidoTemplate(template: unknown): asserts template is Template {
  expect(template).toBeDefined();
  expect(typeof template).toBe('object');
  
  const t = template as Record<string, unknown>;
  
  // Required string properties
  expect(typeof t.name).toBe('string');
  expect(typeof t.fileName).toBe('string');
  expect(typeof t.version).toBe('string');
  expect(typeof t.description).toBe('string');
  expect(typeof t.owner).toBe('string');
  
  // fields must be array of valid Field objects
  expect(Array.isArray(t.fields)).toBe(true);
  for (const field of t.fields as unknown[]) {
    assertValidGuidoField(field);
  }
  
  // ruleSets must be array of valid RuleSet objects
  expect(Array.isArray(t.ruleSets)).toBe(true);
  for (const ruleSet of t.ruleSets as unknown[]) {
    assertValidGuidoRuleSet(ruleSet);
  }
}

describe('Schema to Guido Converter', () => {
  describe('jsonSchemaToGuido', () => {
    it('should convert basic string property with valid Field structure', () => {
      const schema: JSONSchema = {
        title: 'Test Schema',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name field',
          },
        },
      };

      const { template, warnings } = jsonSchemaToGuido(schema);

      // Validate entire template structure
      assertValidGuidoTemplate(template);
      
      expect(template.name).toBe('Test Schema');
      expect(template.fields).toHaveLength(1);
      
      // Each field must have correct flat structure
      const field = template.fields[0];
      assertValidGuidoField(field);
      expect(field.name).toBe('name');
      expect(field.info).toBe('The name field');
      expect(field.range).toBe('string');
      expect(warnings).toHaveLength(0);
    });

    it('should convert enum to pipe-separated range', () => {
      const schema: JSONSchema = {
        title: 'Enum Test',
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
          },
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      expect(template.fields[0].range).toBe('active||inactive||pending');
    });

    it('should convert number types', () => {
      const schema: JSONSchema = {
        title: 'Number Test',
        type: 'object',
        properties: {
          count: { type: 'integer' },
          amount: { type: 'number' },
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      expect(template.fields[0].range).toBe('integer');
      // Note: 'number' type is not a supported FieldRange, so it becomes 'string'
      expect(template.fields[1].range).toBe('string');
    });

    it('should convert boolean type', () => {
      const schema: JSONSchema = {
        title: 'Boolean Test',
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      expect(template.fields[0].range).toBe('boolean');
    });

    it('should flatten nested objects with dot-notation names', () => {
      const schema: JSONSchema = {
        title: 'Nested Test',
        type: 'object',
        properties: {
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
            },
          },
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      expect(template.fields).toHaveLength(2);
      expect(template.fields[0].name).toBe('address.street');
      expect(template.fields[1].name).toBe('address.city');
      
      // Verify flat structure - no nested fields
      template.fields.forEach(f => {
        assertValidGuidoField(f);
        expect((f as unknown as Record<string, unknown>).fields).toBeUndefined();
      });
    });

    it('should handle default values', () => {
      const schema: JSONSchema = {
        title: 'Default Test',
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
          },
          count: {
            type: 'integer',
            default: 10,
          },
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      expect(template.fields[0].value).toBe('true');
      expect(template.fields[1].value).toBe('10');
    });

    it('should handle URL format', () => {
      const schema: JSONSchema = {
        title: 'URL Test',
        type: 'object',
        properties: {
          website: {
            type: 'string',
            format: 'uri',
          },
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      expect(template.fields[0].range).toBe('url');
    });

    it('should handle integer with min/max', () => {
      const schema: JSONSchema = {
        title: 'Range Test',
        type: 'object',
        properties: {
          score: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
          },
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      // Integer with bounds uses new syntax: integer(min..max)
      expect(template.fields[0].range).toBe('integer(0..100)');
    });

    it('should handle pattern', () => {
      const schema: JSONSchema = {
        title: 'Pattern Test',
        type: 'object',
        properties: {
          code: {
            type: 'string',
            pattern: '^[A-Z]{3}$',
          },
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      expect(template.fields[0].range).toBe('^[A-Z]{3}$');
    });
  });

  describe('Rule Generation', () => {
    it('should generate rules for required fields', () => {
      const schema: JSONSchema = {
        title: 'Required Test',
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          optional: { type: 'string' },
        },
        required: ['name', 'email'],
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      // Should have 1 merged rule with all unconditional required fields as targets
      const rules = template.ruleSets[0].rules;
      expect(rules.length).toBe(1);
      
      const rule = rules[0];
      assertValidGuidoRule(rule);
      // Unconditional required = no conditions
      expect(rule.conditions).toBeUndefined();
      // Should have 2 targets (name and email)
      expect(rule.targets.length).toBe(2);
      // All targets should be "set" state
      rule.targets.forEach(target => {
        expect(target.state).toBe(RuleState.Set);
      });

      // Check specific fields are marked required in the merged rule
      const targetNames = rule.targets.map(t => t.name);
      expect(targetNames).toContain('name');
      expect(targetNames).toContain('email');
      expect(targetNames).not.toContain('optional');
    });

    it('should generate conditional rules for dependentRequired', () => {
      const schema: JSONSchema = {
        title: 'Dependent Test',
        type: 'object',
        properties: {
          creditCard: { type: 'string' },
          billingAddress: { type: 'string' },
        },
        dependentRequired: {
          creditCard: ['billingAddress'],
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      // Should have 1 conditional rule
      const rules = template.ruleSets[0].rules;
      expect(rules.length).toBe(1);
      
      const rule = rules[0];
      assertValidGuidoRule(rule);
      
      // Should have a condition
      expect(rule.conditions).toBeDefined();
      expect(rule.conditions!.length).toBe(1);
      expect(rule.conditions![0].name).toBe('creditCard');
      expect(rule.conditions![0].state).toBe(RuleState.Set);
      
      // Target is billingAddress
      expect(rule.targets[0].name).toBe('billingAddress');
      expect(rule.targets[0].state).toBe(RuleState.Set);
    });

    it('should generate rules for if/then/else conditionals', () => {
      const schema: JSONSchema = {
        title: 'Conditional Test',
        type: 'object',
        properties: {
          country: { type: 'string' },
          postalCode: { type: 'string' },
          zipCode: { type: 'string' },
        },
        if: {
          properties: {
            country: { const: 'USA' },
          },
        },
        then: {
          required: ['zipCode'],
        },
        else: {
          required: ['postalCode'],
        },
      };

      const { template } = jsonSchemaToGuido(schema);
      assertValidGuidoTemplate(template);

      // Should have 2 conditional rules
      const rules = template.ruleSets[0].rules;
      expect(rules.length).toBe(2);
      
      // Find the "then" rule (when country = USA, zipCode required)
      const thenRule = rules.find(r => 
        r.targets[0].name === 'zipCode'
      );
      expect(thenRule).toBeDefined();
      assertValidGuidoRule(thenRule!);
      expect(thenRule.conditions![0].name).toBe('country');
      expect(thenRule.conditions![0].state).toBe(RuleState.SetToValue);
      expect(thenRule.conditions![0].value).toBe('USA');
      expect(thenRule.conditions![0].not).toBeUndefined();
      
      // Find the "else" rule (when country != USA, postalCode required)
      const elseRule = rules.find(r => 
        r.targets[0].name === 'postalCode'
      );
      expect(elseRule).toBeDefined();
      assertValidGuidoRule(elseRule!);
      expect(elseRule.conditions![0].name).toBe('country');
      expect(elseRule.conditions![0].state).toBe(RuleState.SetToValue);
      expect(elseRule.conditions![0].value).toBe('USA');
      expect(elseRule.conditions![0].not).toBe(true);
    });

    it('should NOT have old incorrect rule properties', () => {
      const schema: JSONSchema = {
        title: 'No Old Props',
        type: 'object',
        properties: {
          required_field: { type: 'string' },
        },
        required: ['required_field'],
      };

      const { template } = jsonSchemaToGuido(schema);
      
      const rules = template.ruleSets[0].rules;
      expect(rules.length).toBe(1);
      const rule = rules[0] as unknown as Record<string, unknown>;
      
      // These would be from the OLD incorrect format
      expect(rule.id).toBeUndefined();
      expect(rule.action).toBeUndefined();
      expect(rule.targetFields).toBeUndefined();
      expect(rule.description).toBeUndefined();
      expect(rule.operator).toBeUndefined();
      
      // Should have correct structure
      expect(rule.targets).toBeDefined();
      expect(Array.isArray(rule.targets)).toBe(true);
    });
  });
});

describe('Guido to Schema Converter', () => {
  describe('guidoToJsonSchema', () => {
    it('should convert basic string field with valid structure', () => {
      const template: Template = {
        name: 'Test Template',
        version: '1.0.0',
        description: 'A test template',
        owner: '',
        fileName: '',
        fields: [
          {
            name: 'host',
            value: 'localhost',
            info: 'The hostname',
            example: 'localhost',
            range: 'string',
          },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      // Verify input is valid Guido format
      assertValidGuidoTemplate(template);

      const { schema, warnings } = guidoToJsonSchema(template);

      expect(schema.title).toBe('Test Template');
      expect(schema.properties?.host).toMatchObject({
        type: 'string',
        description: 'The hostname',
        default: 'localhost',
      });
      expect(warnings).toHaveLength(0);
    });

    it('should convert options range to enum', () => {
      const template: Template = {
        name: 'Enum Test',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          {
            name: 'level',
            value: 'info',
            info: '',
            example: '',
            range: 'debug / info / warn / error',
          },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      assertValidGuidoTemplate(template);
      const { schema } = guidoToJsonSchema(template);

      expect(schema.properties?.level).toMatchObject({
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error'],
        default: 'info',
      });
    });

    it('should convert nested field paths to objects', () => {
      const template: Template = {
        name: 'Nested Test',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'db.host', value: 'localhost', info: '', example: '', range: 'string' },
          { name: 'db.port', value: '5432', info: '', example: '', range: 'integer' },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      assertValidGuidoTemplate(template);
      const { schema } = guidoToJsonSchema(template);

      expect(schema.properties?.db).toMatchObject({
        type: 'object',
        properties: {
          host: { type: 'string', default: 'localhost' },
          port: { type: 'integer', default: 5432 },
        },
      });
    });

    it('should convert boolean range', () => {
      const template: Template = {
        name: 'Boolean Test',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'enabled', value: 'true', info: '', example: '', range: 'boolean' },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      assertValidGuidoTemplate(template);
      const { schema } = guidoToJsonSchema(template);

      expect(schema.properties?.enabled).toMatchObject({
        type: 'boolean',
        default: true,
      });
    });

    it('should convert url range', () => {
      const template: Template = {
        name: 'URL Test',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'endpoint', value: 'https://api.example.com', info: '', example: '', range: 'url' },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      assertValidGuidoTemplate(template);
      const { schema } = guidoToJsonSchema(template);

      expect(schema.properties?.endpoint).toMatchObject({
        type: 'string',
        format: 'uri',
        default: 'https://api.example.com',
      });
    });

    it('should convert integer range with bounds', () => {
      const template: Template = {
        name: 'Integer Test',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'score', value: '50', info: '', example: '', range: 'integer(0..100)' },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      assertValidGuidoTemplate(template);
      const { schema } = guidoToJsonSchema(template);

      expect(schema.properties?.score).toMatchObject({
        type: 'integer',
        minimum: 0,
        maximum: 100,
        default: 50,
      });
    });

    it('should convert regex pattern range', () => {
      const template: Template = {
        name: 'Pattern Test',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'code', value: '', info: '', example: '', range: '^[A-Z]{3}$' },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      assertValidGuidoTemplate(template);
      const { schema } = guidoToJsonSchema(template);

      expect(schema.properties?.code).toMatchObject({
        type: 'string',
        pattern: '^[A-Z]{3}$',
      });
    });

    it('should convert required rules to schema required array', () => {
      const template: Template = {
        name: 'Required Test',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'name', value: '', info: '', example: '', range: 'string' },
          { name: 'email', value: '', info: '', example: '', range: 'string' },
          { name: 'optional', value: '', info: '', example: '', range: 'string' },
        ],
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [
            { targets: [{ name: 'name', state: RuleState.Set }] },
            { targets: [{ name: 'email', state: RuleState.Set }] },
          ],
        }],
      };

      assertValidGuidoTemplate(template);
      const { schema } = guidoToJsonSchema(template);

      expect(schema.required).toBeDefined();
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('email');
      expect(schema.required).not.toContain('optional');
    });
  });
});

describe('Roundtrip Conversion', () => {
  describe('Schema → Guido → Schema', () => {
    it('should preserve basic properties through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Roundtrip Test',
        description: 'Testing roundtrip conversion',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'A name',
            default: 'test',
          },
          count: {
            type: 'integer',
            default: 5,
          },
          enabled: {
            type: 'boolean',
            default: true,
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      
      // Validate intermediate Guido format
      assertValidGuidoTemplate(template);
      template.fields.forEach(f => assertValidGuidoField(f));
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      expect(resultSchema.title).toBe(originalSchema.title);
      expect(resultSchema.description).toBe(originalSchema.description);
      expect(resultSchema.properties?.name?.type).toBe('string');
      expect(resultSchema.properties?.name?.default).toBe('test');
      expect(resultSchema.properties?.count?.type).toBe('integer');
      expect(resultSchema.properties?.count?.default).toBe(5);
      expect(resultSchema.properties?.enabled?.type).toBe('boolean');
      expect(resultSchema.properties?.enabled?.default).toBe(true);
    });

    it('should preserve enum values through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Enum Roundtrip',
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected'],
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      assertValidGuidoTemplate(template);
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      expect(resultSchema.properties?.status?.enum).toEqual(['pending', 'approved', 'rejected']);
    });

    it('should preserve nested objects through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Nested Roundtrip',
        type: 'object',
        properties: {
          database: {
            type: 'object',
            properties: {
              host: { type: 'string', default: 'localhost' },
              port: { type: 'integer', default: 5432 },
            },
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      assertValidGuidoTemplate(template);
      
      // Fields should be flat with dot notation
      expect(template.fields.find(f => f.name === 'database.host')).toBeDefined();
      expect(template.fields.find(f => f.name === 'database.port')).toBeDefined();
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      expect(resultSchema.properties?.database?.type).toBe('object');
      expect(resultSchema.properties?.database?.properties?.host?.type).toBe('string');
      expect(resultSchema.properties?.database?.properties?.port?.type).toBe('integer');
    });

    it('should preserve required fields through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Required Roundtrip',
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          optional: { type: 'string' },
        },
        required: ['name', 'email'],
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      assertValidGuidoTemplate(template);
      
      // Should have 1 merged rule with all required fields as targets
      const rules = template.ruleSets[0].rules;
      expect(rules.length).toBe(1);
      assertValidGuidoRule(rules[0]);
      expect(rules[0].targets.length).toBe(2);
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      expect(resultSchema.required).toContain('name');
      expect(resultSchema.required).toContain('email');
      expect(resultSchema.required).not.toContain('optional');
    });
  });

  describe('Guido → Schema → Guido', () => {
    it('should preserve basic fields through roundtrip', () => {
      const originalTemplate: Template = {
        name: 'Original Template',
        version: '1.0.0',
        description: 'A test template',
        owner: '',
        fileName: '',
        fields: [
          { name: 'username', value: 'admin', info: 'Enter username', example: 'admin', range: 'string' },
          { name: 'age', value: '18', info: '', example: '18', range: 'integer' },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      assertValidGuidoTemplate(originalTemplate);

      const { schema } = guidoToJsonSchema(originalTemplate);
      const { template: resultTemplate } = jsonSchemaToGuido(schema);

      assertValidGuidoTemplate(resultTemplate);
      expect(resultTemplate.name).toBe(originalTemplate.name);
      
      const usernameField = resultTemplate.fields.find(f => f.name === 'username');
      assertValidGuidoField(usernameField!);
      expect(usernameField?.value).toBe('admin');
      expect(usernameField?.info).toBe('Enter username');

      const ageField = resultTemplate.fields.find(f => f.name === 'age');
      assertValidGuidoField(ageField!);
      expect(ageField?.value).toBe('18');
      expect(ageField?.range).toBe('integer');
    });

    it('should preserve options through roundtrip', () => {
      const originalTemplate: Template = {
        name: 'Options Template',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'priority', value: 'medium', info: '', example: '', range: 'low||medium||high' },
        ],
        ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
      };

      assertValidGuidoTemplate(originalTemplate);

      const { schema } = guidoToJsonSchema(originalTemplate);
      const { template: resultTemplate } = jsonSchemaToGuido(schema);

      assertValidGuidoTemplate(resultTemplate);
      const field = resultTemplate.fields.find(f => f.name === 'priority');
      assertValidGuidoField(field!);
      expect(field?.range).toBe('low||medium||high');
    });

    it('should preserve required rules through roundtrip', () => {
      const originalTemplate: Template = {
        name: 'Rules Template',
        version: '1.0.0',
        description: '',
        owner: '',
        fileName: '',
        fields: [
          { name: 'name', value: '', info: '', example: '', range: 'string' },
          { name: 'email', value: '', info: '', example: '', range: 'string' },
        ],
        ruleSets: [{
          name: 'Default',
          description: '',
          tags: [],
          rules: [
            { targets: [{ name: 'name', state: RuleState.Set }] },
            { targets: [{ name: 'email', state: RuleState.Set }] },
          ],
        }],
      };

      assertValidGuidoTemplate(originalTemplate);

      const { schema } = guidoToJsonSchema(originalTemplate);
      const { template: resultTemplate } = jsonSchemaToGuido(schema);

      assertValidGuidoTemplate(resultTemplate);
      // After roundtrip, unconditional required rules are merged into 1 rule
      const resultRules = resultTemplate.ruleSets[0].rules;
      expect(resultRules.length).toBe(1);
      expect(resultRules[0].targets.length).toBe(2);
      
      const targetNames = resultRules[0].targets.map(t => t.name);
      expect(targetNames).toContain('name');
      expect(targetNames).toContain('email');
    });
  });

  describe('Comprehensive Roundtrip Verification', () => {
    it('should preserve ALL field properties through Schema → Guido → Schema', () => {
      const originalSchema: JSONSchema = {
        title: 'Complete Field Test',
        description: 'Testing all field properties survive roundtrip',
        type: 'object',
        properties: {
          stringField: {
            type: 'string',
            description: 'A string field with all properties',
            default: 'default-value',
          },
          integerField: {
            type: 'integer',
            default: 50,
          },
          urlField: {
            type: 'string',
            format: 'uri',
            default: 'https://example.com',
          },
          booleanField: {
            type: 'boolean',
            default: true,
          },
          enumField: {
            type: 'string',
            enum: ['option1', 'option2', 'option3'],
            default: 'option2',
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      assertValidGuidoTemplate(template);
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      // Verify ALL properties survived
      expect(resultSchema.title).toBe(originalSchema.title);
      expect(resultSchema.description).toBe(originalSchema.description);
      
      // String field
      expect(resultSchema.properties?.stringField?.type).toBe('string');
      expect(resultSchema.properties?.stringField?.description).toBe('A string field with all properties');
      expect(resultSchema.properties?.stringField?.default).toBe('default-value');
      
      // Integer field (basic - without range constraints)
      expect(resultSchema.properties?.integerField?.type).toBe('integer');
      expect(resultSchema.properties?.integerField?.default).toBe(50);
      
      // URL field
      expect(resultSchema.properties?.urlField?.type).toBe('string');
      expect(resultSchema.properties?.urlField?.format).toBe('uri');
      expect(resultSchema.properties?.urlField?.default).toBe('https://example.com');
      
      // Boolean field
      expect(resultSchema.properties?.booleanField?.type).toBe('boolean');
      expect(resultSchema.properties?.booleanField?.default).toBe(true);
      
      // Enum field
      expect(resultSchema.properties?.enumField?.enum).toEqual(['option1', 'option2', 'option3']);
      expect(resultSchema.properties?.enumField?.default).toBe('option2');
    });

    it('should preserve integer min/max through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Integer Range Test',
        type: 'object',
        properties: {
          port: {
            type: 'integer',
            minimum: 1,
            maximum: 65535,
            default: 8080,
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      assertValidGuidoTemplate(template);
      
      // Verify range is stored correctly in Guido with new syntax
      const portField = template.fields.find(f => f.name === 'port');
      expect(portField?.range).toBe('integer(1..65535)');
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      // Now min/max survives roundtrip with new syntax!
      expect(resultSchema.properties?.port?.type).toBe('integer');
      expect(resultSchema.properties?.port?.minimum).toBe(1);
      expect(resultSchema.properties?.port?.maximum).toBe(65535);
    });

    it('should preserve ALL field properties through Guido → Schema → Guido', () => {
      const originalTemplate: Template = {
        name: 'Complete Template',
        version: '2.0.0',
        description: 'A comprehensive test template',
        owner: 'TestOwner',
        fileName: 'config.json',
        fields: [
          { 
            name: 'server.host', 
            value: 'localhost', 
            info: 'The server hostname', 
            example: 'localhost', 
            range: 'string',
            link: 'https://docs.example.com/host',
          },
          { 
            name: 'server.port', 
            value: '8080', 
            info: 'The server port', 
            example: '8080', 
            range: 'integer', // Use basic integer, not integer(1-65535) for now
          },
          { 
            name: 'server.ssl', 
            value: 'true', 
            info: 'Enable SSL', 
            example: 'true', 
            range: 'boolean',
          },
          { 
            name: 'logLevel', 
            value: 'info', 
            info: 'Logging level', 
            example: 'info', 
            range: 'debug||info||warn||error',
          },
          { 
            name: 'database.url', 
            value: 'https://db.example.com', 
            info: 'Database URL', 
            example: 'https://db.example.com', 
            range: 'url',
          },
        ],
        ruleSets: [],
      };

      assertValidGuidoTemplate(originalTemplate);

      const { schema } = guidoToJsonSchema(originalTemplate);
      const { template: resultTemplate } = jsonSchemaToGuido(schema);

      assertValidGuidoTemplate(resultTemplate);
      
      // Template metadata
      expect(resultTemplate.name).toBe(originalTemplate.name);
      expect(resultTemplate.description).toBe(originalTemplate.description);
      
      // Verify each field survived with all properties
      originalTemplate.fields.forEach(originalField => {
        const resultField = resultTemplate.fields.find(f => f.name === originalField.name);
        expect(resultField).toBeDefined();
        assertValidGuidoField(resultField!);
        
        expect(resultField.value).toBe(originalField.value);
        expect(resultField.info).toBe(originalField.info);
        expect(resultField.range).toBe(originalField.range);
        // Note: link may not survive roundtrip through JSON Schema (no equivalent)
      });
    });

    it('should preserve array fields through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Array Test',
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            default: ['tag1', 'tag2'],
          },
          ports: {
            type: 'array',
            items: { type: 'integer' },
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      assertValidGuidoTemplate(template);
      
      // Verify array is stored in Guido format with new syntax
      const tagsField = template.fields.find(f => f.name === 'tags');
      expect(tagsField).toBeDefined();
      expect(tagsField?.range).toBe('string[]');
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      // Arrays now survive roundtrip with new syntax!
      expect(resultSchema.properties?.tags?.type).toBe('array');
      const tagsItems = resultSchema.properties?.tags?.items;
      expect(Array.isArray(tagsItems) ? tagsItems[0]?.type : tagsItems?.type).toBe('string');
      expect(resultSchema.properties?.ports?.type).toBe('array');
      const portsItems = resultSchema.properties?.ports?.items;
      expect(Array.isArray(portsItems) ? portsItems[0]?.type : portsItems?.type).toBe('integer');
    });

    it('should preserve pattern/regex through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Pattern Test',
        type: 'object',
        properties: {
          email: {
            type: 'string',
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          },
          code: {
            type: 'string',
            pattern: '^[A-Z]{3}-[0-9]{4}$',
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      assertValidGuidoTemplate(template);
      
      // Verify patterns are stored in range
      const emailField = template.fields.find(f => f.name === 'email');
      expect(emailField?.range).toContain('^[a-zA-Z0-9._%+-]+@');
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      expect(resultSchema.properties?.email?.pattern).toBe(originalSchema.properties?.email?.pattern);
      expect(resultSchema.properties?.code?.pattern).toBe(originalSchema.properties?.code?.pattern);
    });

    it('should preserve deeply nested structures through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Deep Nesting',
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      deepValue: { type: 'string', default: 'deep' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      assertValidGuidoTemplate(template);
      
      // Should flatten to dot notation
      const deepField = template.fields.find(f => f.name === 'level1.level2.level3.deepValue');
      expect(deepField).toBeDefined();
      expect(deepField?.value).toBe('deep');
      
      const { schema: resultSchema } = guidoToJsonSchema(template);

      // Should reconstruct nested structure
      expect(resultSchema.properties?.level1?.properties?.level2?.properties?.level3?.properties?.deepValue?.default).toBe('deep');
    });

    it('should preserve field count through roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Field Count Test',
        type: 'object',
        properties: {
          a: { type: 'string', default: 'a' },
          b: { type: 'string', default: 'b' },
          c: { type: 'string', default: 'c' },
          nested: {
            type: 'object',
            properties: {
              d: { type: 'string', default: 'd' },
              e: { type: 'string', default: 'e' },
            },
          },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      const originalFieldCount = template.fields.length;
      expect(originalFieldCount).toBe(5); // a, b, c, nested.d, nested.e
      
      const { schema: resultSchema } = guidoToJsonSchema(template);
      const { template: roundtrippedTemplate } = jsonSchemaToGuido(resultSchema);
      
      // Field count should be identical after full roundtrip
      expect(roundtrippedTemplate.fields.length).toBe(originalFieldCount);
    });

    it('should preserve multiple required fields through double roundtrip', () => {
      const originalSchema: JSONSchema = {
        title: 'Multiple Required',
        type: 'object',
        properties: {
          field1: { type: 'string' },
          field2: { type: 'string' },
          field3: { type: 'string' },
          optional: { type: 'string' },
        },
        required: ['field1', 'field2', 'field3'],
      };

      // First roundtrip
      const { template: template1 } = jsonSchemaToGuido(originalSchema);
      const { schema: schema1 } = guidoToJsonSchema(template1);
      
      // Second roundtrip
      const { template: template2 } = jsonSchemaToGuido(schema1);
      const { schema: schema2 } = guidoToJsonSchema(template2);

      // Required fields should still be there after double roundtrip
      expect(schema2.required).toContain('field1');
      expect(schema2.required).toContain('field2');
      expect(schema2.required).toContain('field3');
      expect(schema2.required).not.toContain('optional');
      expect(schema2.required?.length).toBe(3);
    });

    it('should not lose any top-level schema properties', () => {
      const originalSchema: JSONSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Full Schema',
        description: 'A complete schema with all metadata',
        type: 'object',
        properties: {
          test: { type: 'string', default: 'test' },
        },
      };

      const { template } = jsonSchemaToGuido(originalSchema);
      const { schema: resultSchema } = guidoToJsonSchema(template);

      expect(resultSchema.$schema).toBeDefined();
      expect(resultSchema.title).toBe(originalSchema.title);
      expect(resultSchema.description).toBe(originalSchema.description);
      expect(resultSchema.type).toBe('object');
    });
  });
});

describe('$ref and Definitions', () => {
  it('should resolve $ref to definitions', () => {
    const schema: JSONSchema = {
      title: 'Ref Test',
      type: 'object',
      properties: {
        user: { $ref: '#/$defs/User' } as unknown as JSONSchema,
      },
      $defs: {
        User: {
          type: 'object',
          properties: {
            name: { type: 'string', default: 'John' },
            age: { type: 'integer', default: 30 },
          },
        },
      },
    } as unknown as JSONSchema;

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    // Should flatten the referenced definition
    expect(template.fields.length).toBeGreaterThanOrEqual(2);
    expect(template.fields.find(f => f.name === 'user.name')).toBeDefined();
    expect(template.fields.find(f => f.name === 'user.age')).toBeDefined();
  });

  it('should resolve nested $refs', () => {
    const schema: JSONSchema = {
      title: 'Nested Ref',
      type: 'object',
      $defs: {
        Address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
          },
        },
      },
      properties: {
        home: { $ref: '#/$defs/Address' } as unknown as JSONSchema,
        work: { $ref: '#/$defs/Address' } as unknown as JSONSchema,
      },
    } as unknown as JSONSchema;

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    expect(template.fields.find(f => f.name === 'home.street')).toBeDefined();
    expect(template.fields.find(f => f.name === 'work.street')).toBeDefined();
  });
});

describe('Array Handling', () => {
  it('should handle array with object items', () => {
    const schema: JSONSchema = {
      title: 'Array Items Test',
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string', format: 'email' },
            },
          },
        },
      },
    } as unknown as JSONSchema;

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    // Array items properties should be flattened
    expect(template.fields.find(f => f.name === 'users.name')).toBeDefined();
    expect(template.fields.find(f => f.name === 'users.email')).toBeDefined();
  });

  it('should handle simple array type', () => {
    const schema: JSONSchema = {
      title: 'Simple Array',
      type: 'object',
      properties: {
        tags: { type: 'array' },
      },
    };

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    // Arrays use new syntax: string[] (default item type is string)
    expect(template.fields[0].range).toBe('string[]');
  });
});

describe('Warnings', () => {
  it('should warn about anyOf schemas', () => {
    const schema = {
      title: 'AnyOf Test',
      type: 'object',
      properties: {
        value: { type: 'string' },
      },
      anyOf: [
        { properties: { type: { const: 'a' } } },
        { properties: { type: { const: 'b' } } },
      ],
    } as unknown as JSONSchema;

    const { warnings } = jsonSchemaToGuido(schema);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('anyOf');
  });

  it('should warn about oneOf schemas', () => {
    const schema = {
      title: 'OneOf Test',
      type: 'object',
      properties: {
        value: { type: 'string' },
      },
      oneOf: [
        { properties: { format: { const: 'json' } } },
        { properties: { format: { const: 'xml' } } },
      ],
    } as unknown as JSONSchema;

    const { warnings } = jsonSchemaToGuido(schema);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('oneOf');
  });
});

describe('Nested Required Fields', () => {
  it('should handle required fields in nested objects', () => {
    const schema: JSONSchema = {
      title: 'Nested Required',
      type: 'object',
      properties: {
        database: {
          type: 'object',
          properties: {
            host: { type: 'string' },
            port: { type: 'integer' },
            name: { type: 'string' },
          },
          required: ['host', 'port'],
        },
      },
    };

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    // Should generate 1 merged rule for the nested required fields
    const rules = template.ruleSets[0].rules;
    expect(rules.length).toBe(1);
    const targetNames = rules[0].targets.map(t => t.name);
    expect(targetNames).toContain('database.host');
    expect(targetNames).toContain('database.port');
    expect(targetNames).not.toContain('database.name');
  });

  it('should roundtrip nested required fields', () => {
    const schema: JSONSchema = {
      title: 'Nested Required Roundtrip',
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            secret: { type: 'string' },
          },
          required: ['key'],
        },
      },
    };

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    const { schema: resultSchema } = guidoToJsonSchema(template);

    // The nested required should be preserved
    expect(resultSchema.properties?.config?.required).toContain('key');
    expect(resultSchema.properties?.config?.required).not.toContain('secret');
  });
});

describe('Edge Cases', () => {
  it('should handle empty schema', () => {
    const schema: JSONSchema = {
      title: 'Empty',
      type: 'object',
    };

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);
    expect(template.fields).toHaveLength(0);
    expect(template.ruleSets[0].rules).toHaveLength(0);
  });

  it('should handle empty template', () => {
    const template: Template = {
      name: 'Empty',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [],
      ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
    };

    assertValidGuidoTemplate(template);
    const { schema } = guidoToJsonSchema(template);
    expect(schema.properties).toEqual({});
  });

  it('should handle deeply nested paths with flat structure', () => {
    const template: Template = {
      name: 'Deep',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { name: 'a.b.c.d.e', value: 'deep', info: '', example: '', range: 'string' },
      ],
      ruleSets: [],
    };

    assertValidGuidoTemplate(template);
    // Field should be flat, not nested
    expect(template.fields[0].name).toBe('a.b.c.d.e');
    expect((template.fields[0] as unknown as Record<string, unknown>).fields).toBeUndefined();
    
    const { schema } = guidoToJsonSchema(template);
    expect(schema.properties?.a?.properties?.b?.properties?.c?.properties?.d?.properties?.e?.default).toBe('deep');
  });

  it('should handle special characters in field names', () => {
    const schema: JSONSchema = {
      title: 'Special',
      type: 'object',
      properties: {
        '$schema': { type: 'string', default: 'https://example.com' },
      },
    };

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);
    expect(template.fields[0].name).toBe('$schema');
    expect(template.fields[0].value).toBe('https://example.com');
  });

  it('should reject templates with nested fields property', () => {
    // This simulates the OLD incorrect format that had nested fields
    const badTemplate = {
      name: 'Bad Template',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { 
          name: 'parent', 
          value: '', 
          info: '', 
          example: '', 
          range: 'string',
          fields: [  // This is WRONG - Field should not have nested fields
            { name: 'child', value: '', info: '', example: '', range: 'string' }
          ]
        },
      ],
      ruleSets: [],
    };

    // This should fail validation because Field should not have nested 'fields'
    expect(() => assertValidGuidoField(badTemplate.fields[0])).toThrow();
  });

  it('should reject rules with old incorrect format', () => {
    // This simulates the OLD incorrect rule format
    const badRule = {
      id: 'rule-1',  // WRONG - Rule doesn't have id
      action: 'required',  // WRONG - Rule doesn't have action
      targetFields: ['name'],  // WRONG - Rule uses targets with RuleDomain
      conditions: [{ field: 'x', operator: '==', value: 'y' }],  // WRONG format
    };

    expect(() => assertValidGuidoRule(badRule)).toThrow();
  });
});

describe('Type Validation', () => {
  it('should produce fields with all required string properties', () => {
    const schema: JSONSchema = {
      title: 'Type Test',
      type: 'object',
      properties: {
        test: { type: 'string', description: 'A test', default: 'value' },
      },
    };

    const { template } = jsonSchemaToGuido(schema);
    const field = template.fields[0];

    // All these must be strings, not undefined
    expect(typeof field.name).toBe('string');
    expect(typeof field.value).toBe('string');
    expect(typeof field.info).toBe('string');
    expect(typeof field.example).toBe('string');
    expect(typeof field.range).toBe('string');
    
    // These must not be present (they're from NestedField, not Field)
    expect('fields' in field).toBe(false);
    expect('type' in field).toBe(false);
    expect('options' in field).toBe(false);
  });

  it('should produce rules with correct RuleDomain structure', () => {
    const schema: JSONSchema = {
      title: 'Rule Type Test',
      type: 'object',
      properties: {
        required_field: { type: 'string' },
      },
      required: ['required_field'],
    };

    const { template } = jsonSchemaToGuido(schema);
    const rule = template.ruleSets[0].rules[0];

    // targets must be array
    expect(Array.isArray(rule.targets)).toBe(true);
    expect(rule.targets.length).toBeGreaterThan(0);

    // Each target must have name (string) and state (RuleState enum)
    const target = rule.targets[0];
    expect(typeof target.name).toBe('string');
    expect(Object.values(RuleState)).toContain(target.state);
    
    // value and not are optional
    if (target.value !== undefined) {
      expect(typeof target.value).toBe('string');
    }
    if (target.not !== undefined) {
      expect(typeof target.not).toBe('boolean');
    }
  });
});


describe('Field Optional Properties', () => {
  it('should accept link property on fields', () => {
    const template: Template = {
      name: 'Link Test',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { 
          name: 'setting', 
          value: '', 
          info: 'See docs', 
          example: '', 
          range: 'string',
          link: 'https://docs.example.com/setting'
        },
      ],
      ruleSets: [],
    };

    assertValidGuidoTemplate(template);
    expect(template.fields[0].link).toBe('https://docs.example.com/setting');
  });

  it('should accept checked property on fields', () => {
    const template: Template = {
      name: 'Checked Test',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { 
          name: 'enabled', 
          value: 'true', 
          info: '', 
          example: '', 
          range: 'boolean',
          checked: true
        },
      ],
      ruleSets: [],
    };

    assertValidGuidoTemplate(template);
    expect(template.fields[0].checked).toBe(true);
  });
});

describe('RuleState.Contains', () => {
  it('should accept rules with Contains state', () => {
    const rule: Rule = {
      conditions: [
        { name: 'list', state: RuleState.Contains, value: 'item1' },
      ],
      targets: [
        { name: 'related', state: RuleState.Set },
      ],
    };

    assertValidGuidoRule(rule);
    expect(rule.conditions![0].state).toBe(RuleState.Contains);
    expect(rule.conditions![0].value).toBe('item1');
  });

  it('should handle Contains state in template rules', () => {
    const template: Template = {
      name: 'Contains Test',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { name: 'tags', value: '[]', info: '', example: '', range: 'array' },
        { name: 'related', value: '', info: '', example: '', range: 'string' },
      ],
      ruleSets: [{
        name: 'Default',
        description: '',
        tags: [],
        rules: [
          {
            conditions: [
              { name: 'tags', state: RuleState.Contains, value: 'premium' },
            ],
            targets: [
              { name: 'related', state: RuleState.Set },
            ],
          },
        ],
      }],
    };

    assertValidGuidoTemplate(template);
    expect(template.ruleSets[0].rules[0].conditions![0].state).toBe(RuleState.Contains);
  });
});

describe('RuleState.SetToValue', () => {
  it('should accept rules with SetToValue state in targets', () => {
    const rule: Rule = {
      conditions: [
        { name: 'type', state: RuleState.SetToValue, value: 'advanced' },
      ],
      targets: [
        { name: 'mode', state: RuleState.SetToValue, value: 'expert' },
      ],
    };

    assertValidGuidoRule(rule);
    expect(rule.targets[0].state).toBe(RuleState.SetToValue);
    expect(rule.targets[0].value).toBe('expert');
  });
});

describe('Multiple Targets in a Rule', () => {
  it('should handle rules with multiple targets', () => {
    const rule: Rule = {
      conditions: [
        { name: 'enabled', state: RuleState.SetToValue, value: 'true' },
      ],
      targets: [
        { name: 'field1', state: RuleState.Set },
        { name: 'field2', state: RuleState.Set },
        { name: 'field3', state: RuleState.Set },
      ],
    };

    assertValidGuidoRule(rule);
    expect(rule.targets.length).toBe(3);
  });

  it('should validate all targets have correct structure', () => {
    const template: Template = {
      name: 'Multi Target',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { name: 'enabled', value: 'false', info: '', example: '', range: 'boolean' },
        { name: 'field1', value: '', info: '', example: '', range: 'string' },
        { name: 'field2', value: '', info: '', example: '', range: 'string' },
      ],
      ruleSets: [{
        name: 'Default',
        description: '',
        tags: [],
        rules: [
          {
            conditions: [{ name: 'enabled', state: RuleState.SetToValue, value: 'true' }],
            targets: [
              { name: 'field1', state: RuleState.Set },
              { name: 'field2', state: RuleState.Set },
            ],
          },
        ],
      }],
    };

    assertValidGuidoTemplate(template);
  });
});

describe('DependentRequired Roundtrip', () => {
  it('should convert conditional rules to dependentRequired in guidoToSchema', () => {
    const template: Template = {
      name: 'Conditional',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { name: 'creditCard', value: '', info: '', example: '', range: 'string' },
        { name: 'billingAddress', value: '', info: '', example: '', range: 'string' },
      ],
      ruleSets: [{
        name: 'Default',
        description: '',
        tags: [],
        rules: [
          {
            conditions: [{ name: 'creditCard', state: RuleState.Set }],
            targets: [{ name: 'billingAddress', state: RuleState.Set }],
          },
        ],
      }],
    };

    assertValidGuidoTemplate(template);
    const { schema, warnings } = guidoToJsonSchema(template);

    // Should convert to dependentRequired (no warnings expected for simple case)
    expect(schema.dependentRequired).toBeDefined();
    expect(schema.dependentRequired?.creditCard).toContain('billingAddress');
    expect(warnings.length).toBe(0);
  });

  it('should convert value-based conditional rules to if/then in guidoToSchema', () => {
    const template: Template = {
      name: 'IfThen',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { name: 'type', value: '', info: '', example: '', range: 'email||phone' },
        { name: 'email', value: '', info: '', example: '', range: 'string' },
      ],
      ruleSets: [{
        name: 'Default',
        description: '',
        tags: [],
        rules: [
          {
            conditions: [{ name: 'type', state: RuleState.SetToValue, value: 'email' }],
            targets: [{ name: 'email', state: RuleState.Set }],
          },
        ],
      }],
    };

    assertValidGuidoTemplate(template);
    const { schema, warnings } = guidoToJsonSchema(template);

    // Should convert to if/then (using allOf to contain the conditional)
    expect(schema.allOf).toBeDefined();
    expect(schema.allOf?.length).toBe(1);
    expect(schema.allOf?.[0].if).toBeDefined();
    expect(schema.allOf?.[0].then).toBeDefined();
    expect(schema.allOf?.[0].then?.required).toContain('email');
    expect(warnings.length).toBe(0);
  });

  it('should convert AND-chained conditions to allOf inside if clause', () => {
    const template: Template = {
      name: 'AndChained',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [
        { name: 'country', value: '', info: '', example: '', range: 'string' },
        { name: 'paymentType', value: '', info: '', example: '', range: 'string' },
        { name: 'taxId', value: '', info: '', example: '', range: 'string' },
      ],
      ruleSets: [{
        name: 'Default',
        description: '',
        tags: [],
        rules: [
          {
            // If country=US AND paymentType=business → taxId required
            conditions: [
              { name: 'country', state: RuleState.SetToValue, value: 'US' },
              { name: 'paymentType', state: RuleState.SetToValue, value: 'business' },
            ],
            targets: [{ name: 'taxId', state: RuleState.Set }],
          },
        ],
      }],
    };

    assertValidGuidoTemplate(template);
    const { schema, warnings } = guidoToJsonSchema(template);

    // Should have allOf with if/then, where if contains allOf for AND conditions
    expect(schema.allOf).toBeDefined();
    expect(schema.allOf?.length).toBe(1);
    expect(schema.allOf?.[0].if?.allOf).toBeDefined();
    expect(schema.allOf?.[0].if?.allOf?.length).toBe(2);
    expect(schema.allOf?.[0].then?.required).toContain('taxId');
    expect(warnings.length).toBe(0);
  });
});

describe('Format Handling', () => {
  it('should convert email format', () => {
    const schema: JSONSchema = {
      title: 'Email Format',
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
        },
      },
    };

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    // Email format should be preserved or have appropriate example
    expect(template.fields[0].example).toContain('@');
  });

  it('should convert date-time format', () => {
    const schema: JSONSchema = {
      title: 'DateTime Format',
      type: 'object',
      properties: {
        timestamp: {
          type: 'string',
          format: 'date-time',
        },
      },
    };

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);
    expect(template.fields[0]).toBeDefined();
  });
});

describe('allOf Handling', () => {
  it('should merge allOf schemas', () => {
    const schema = {
      title: 'AllOf Test',
      type: 'object',
      allOf: [
        {
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        {
          properties: {
            age: { type: 'integer' },
          },
        },
      ],
    } as unknown as JSONSchema;

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    // Should have both fields from allOf
    expect(template.fields.find(f => f.name === 'name')).toBeDefined();
    expect(template.fields.find(f => f.name === 'age')).toBeDefined();

    // Should have rule for required 'name'
    const ruleNames = template.ruleSets[0].rules.map(r => r.targets[0].name);
    expect(ruleNames).toContain('name');
  });
});

describe('String Length Constraints', () => {
  it('should convert minLength/maxLength to range hint', () => {
    const schema: JSONSchema = {
      title: 'Length Test',
      type: 'object',
      properties: {
        username: {
          type: 'string',
          minLength: 3,
          maxLength: 20,
        },
      },
    };

    const { template } = jsonSchemaToGuido(schema);
    assertValidGuidoTemplate(template);

    // String length constraints now use new syntax: string(min..max)
    expect(template.fields[0].range).toBe('string(3..20)');
  });
});

describe('Conversion Options', () => {
  it('should use provided template name', () => {
    const schema: JSONSchema = {
      title: 'Original Name',
      type: 'object',
      properties: {},
    };

    const { template } = jsonSchemaToGuido(schema, { name: 'Custom Name' });
    assertValidGuidoTemplate(template);
    expect(template.name).toBe('Custom Name');
  });

  it('should use provided version', () => {
    const schema: JSONSchema = {
      title: 'Test',
      type: 'object',
      properties: {},
    };

    const { template } = jsonSchemaToGuido(schema, { version: '2.5.0' });
    assertValidGuidoTemplate(template);
    expect(template.version).toBe('2.5.0');
  });

  it('should use schema $id in guidoToSchema', () => {
    const template: Template = {
      name: 'Test',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [],
      ruleSets: [],
    };

    const { schema } = guidoToJsonSchema(template, { $id: 'https://example.com/schema' });
    expect(schema.$id).toBe('https://example.com/schema');
  });

  it('should use draft 2020-12 when specified', () => {
    const template: Template = {
      name: 'Test',
      version: '1.0.0',
      description: '',
      owner: '',
      fileName: '',
      fields: [],
      ruleSets: [],
    };

    const { schema } = guidoToJsonSchema(template, { draft: '2020-12' });
    expect(schema.$schema).toContain('2020-12');
  });
});
