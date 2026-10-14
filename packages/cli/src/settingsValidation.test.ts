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

  it('reports a value outside its range and a key the template does not declare', () => {
    const result = validateSettings(template, { BASE_URL: 'https://example.org', PORT: '70000', PROT: '1' }, base);
    expect(result.issues.find((i) => i.field === 'PORT')?.type).toBe('invalid');
    expect(result.issues.find((i) => i.field === 'PROT')?.type).toBe('warning');
  });
});
