import { describe, it, expect } from 'vitest';
import { type Template, RuleState } from '@quotentiroler/guido-types';
import { validateSettings } from './settingsValidation.js';

const field = (name: string, range = 'string', checked = false) => ({ name, value: '', info: name, example: '', range, checked });

const template: Template = {
  name: 'Env',
  fileName: '.env',
  version: '1.0.0',
  description: 'env',
  owner: 'test',
  fields: [
    field('BASE_URL', 'url', true),
    field('PORT', 'integer(1..65535)'),
    field('TLS_CERT_FILE'),
    field('TLS_KEY_FILE'),
    field('KEY_FILE'),
    field('KEY_PEM'),
  ],
  ruleSets: [
    {
      name: 'Base',
      description: 'base',
      tags: [],
      rules: [
        {
          description: 'A certificate needs its key',
          conditions: [{ name: 'TLS_CERT_FILE', state: RuleState.Set }],
          targets: [{ name: 'TLS_KEY_FILE', state: RuleState.Set }],
        },
      ],
      constraints: [{ kind: 'at-most-one', fields: ['KEY_FILE', 'KEY_PEM'] }],
    },
    {
      name: 'Deployed',
      description: 'deployed',
      tags: [],
      extends: 'Base',
      rules: [{ description: 'Port is set', targets: [{ name: 'PORT', state: RuleState.Set }] }],
    },
  ],
};

const base = template.ruleSets[0];
const deployed = template.ruleSets[1];
const missing = (result: ReturnType<typeof validateSettings>) =>
  result.issues.filter((i) => i.type === 'missing').map((i) => i.field);

describe('validateSettings', () => {
  it('treats a field the settings leave out as optional unless something requires it', () => {
    const result = validateSettings(template, { BASE_URL: 'https://example.org' }, base);
    expect(result.isValid).toBe(true);
    expect(missing(result)).toEqual([]);
  });

  it('requires a field the template marks checked', () => {
    expect(missing(validateSettings(template, {}, base))).toEqual(['BASE_URL']);
  });

  it('requires a conditional target only when its condition holds', () => {
    expect(missing(validateSettings(template, { BASE_URL: 'https://example.org', TLS_CERT_FILE: 'cert.pem' }, base))).toEqual(['TLS_KEY_FILE']);
    expect(validateSettings(template, { BASE_URL: 'https://example.org', TLS_CERT_FILE: 'cert.pem', TLS_KEY_FILE: 'key.pem' }, base).isValid).toBe(true);
  });

  it('applies the rules and constraints of the ruleset it extends', () => {
    const result = validateSettings(template, { BASE_URL: 'https://example.org', TLS_CERT_FILE: 'cert.pem', KEY_FILE: 'a', KEY_PEM: 'b' }, deployed);
    expect(missing(result).sort()).toEqual(['PORT', 'TLS_KEY_FILE']);
    expect(result.issues.some((i) => i.field === '(constraint)')).toBe(true);
  });

  describe('value rules', () => {
    const valueTemplate: Template = {
      ...template,
      fields: [field('Mode'), field('Environment'), field('Database'), field('DatabaseDriver'), field('Roles', 'string[]')],
      ruleSets: [{
        name: 'Values',
        description: 'value rules',
        tags: [],
        rules: [
          {
            description: 'Debug mode never runs in production',
            conditions: [{ name: 'Mode', state: RuleState.SetToValue, value: 'debug' }],
            targets: [{ name: 'Environment', state: RuleState.SetToValue, value: 'production', not: true }],
          },
          {
            description: 'A database uses the postgres driver',
            conditions: [{ name: 'Database', state: RuleState.Set }],
            targets: [{ name: 'DatabaseDriver', state: RuleState.SetToValue, value: 'postgres' }],
          },
          {
            description: 'Production grants the auditor role',
            conditions: [{ name: 'Environment', state: RuleState.SetToValue, value: 'production' }],
            targets: [{ name: 'Roles', state: RuleState.Contains, value: 'auditor' }],
          },
        ],
      }],
    };
    const values = valueTemplate.ruleSets[0];
    const invalid = (result: ReturnType<typeof validateSettings>) =>
      result.issues.filter((i) => i.type === 'invalid').map((i) => i.field);

    it('refuses a value a negated target forbids, once its condition holds', () => {
      const result = validateSettings(valueTemplate, { Mode: 'debug', Environment: 'production', Roles: ['auditor'] }, values);
      expect(invalid(result)).toEqual(['Environment']);
      expect(result.issues.find((i) => i.field === 'Environment')?.message).toContain('Debug mode never runs in production');
    });

    it('accepts the same value when the condition does not hold', () => {
      expect(validateSettings(valueTemplate, { Mode: 'release', Environment: 'production', Roles: ['auditor'] }, values).isValid).toBe(true);
    });

    it('requires the value a set_to_value target names', () => {
      expect(invalid(validateSettings(valueTemplate, { Database: 'db', DatabaseDriver: 'mysql' }, values))).toEqual(['DatabaseDriver']);
      expect(validateSettings(valueTemplate, { Database: 'db', DatabaseDriver: 'postgres' }, values).isValid).toBe(true);
    });

    it('requires the item a contains target names', () => {
      expect(invalid(validateSettings(valueTemplate, { Environment: 'production', Roles: ['user'] }, values))).toEqual(['Roles']);
      expect(validateSettings(valueTemplate, { Environment: 'production', Roles: ['user', 'auditor'] }, values).isValid).toBe(true);
    });
  });

  it('reports a value outside its range and a key the template does not declare', () => {
    const result = validateSettings(template, { BASE_URL: 'https://example.org', PORT: '70000', PROT: '1' }, base);
    expect(result.issues.find((i) => i.field === 'PORT')?.type).toBe('invalid');
    expect(result.issues.find((i) => i.field === 'PROT')?.type).toBe('warning');
  });
});
