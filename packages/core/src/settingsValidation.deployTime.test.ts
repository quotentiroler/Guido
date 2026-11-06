import { describe, it, expect } from 'vitest';
import { type Template, RuleState } from '@quotentiroler/guido-types';
import { validateSettings } from './settingsValidation.js';

const field = (name: string, range = 'string', secret = false) => ({ name, value: '', info: name, example: '', range, secret });

const template: Template = {
  name: 'Env',
  fileName: '.env',
  version: '1.0.0',
  description: 'env',
  owner: 'test',
  fields: [
    field('BASE_URL', 'url'),
    field('DB_USER'),
    field('DB_PASSWORD', 'string(12..)', true),
    field('CERT'),
    field('KEY'),
    field('MODE', 'dev||prod'),
  ],
  ruleSets: [
    {
      name: 'Deployed',
      description: 'deployed',
      tags: [],
      rules: [
        { description: 'Base URL', targets: [{ name: 'BASE_URL', state: RuleState.Set }] },
        { description: 'Root user', targets: [{ name: 'DB_USER', state: RuleState.SetToValue, value: 'root' }] },
        { description: 'Cert needs key', conditions: [{ name: 'CERT', state: RuleState.Set }], targets: [{ name: 'KEY', state: RuleState.Set }] },
        {
          description: 'Prod needs a password',
          conditions: [{ name: 'MODE', state: RuleState.SetToValue, value: 'prod' }],
          targets: [{ name: 'DB_PASSWORD', state: RuleState.Set }],
        },
      ],
      constraints: [{ kind: 'all-or-none', fields: ['DB_USER', 'DB_PASSWORD'] }],
    },
  ],
};

const deployed = template.ruleSets[0];

describe('validateSettings with deploy-time keys', () => {
  it('counts a deploy-time key as present and skips its value checks', () => {
    const result = validateSettings(template, {}, deployed, { deployTimeKeys: ['BASE_URL', 'DB_USER', 'DB_PASSWORD'] });
    expect(result.issues).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('still reports the same keys when they are absent', () => {
    const result = validateSettings(template, {}, deployed);
    expect(result.issues.map((i) => [i.field, i.type])).toEqual(
      expect.arrayContaining([
        ['BASE_URL', 'missing'],
        ['DB_USER', 'missing'],
      ])
    );
  });

  it('lets a deploy-time key trigger set conditions but no value conditions', () => {
    const triggered = validateSettings(template, { BASE_URL: 'https://x.org', DB_USER: 'root', DB_PASSWORD: 'long-enough-pw' }, deployed, {
      deployTimeKeys: ['CERT', 'MODE'],
    });
    expect(triggered.issues.map((i) => i.field)).toEqual(['KEY']);
  });

  it('never shows a secret value', () => {
    const result = validateSettings(template, { BASE_URL: 'https://x.org', DB_USER: 'root', DB_PASSWORD: 'short' }, deployed);
    const issue = result.issues.find((i) => i.field === 'DB_PASSWORD');
    expect(issue?.type).toBe('invalid');
    expect(issue?.actual).toBeUndefined();
  });
});
