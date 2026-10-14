import { describe, it, expect } from 'vitest';
import { type Template, RuleState } from '@quotentiroler/guido-types';
import { selectRuleSets, validateTemplateRuleSet } from './templateValidation.js';

const field = (name: string) => ({ name, value: '', info: name, example: '', range: 'string', checked: false });

const template: Template = {
  name: 'App',
  fileName: 'app.json',
  version: '1.0.0',
  description: 'app',
  owner: 'test',
  fields: [field('Cache'), field('CacheHost')],
  ruleSets: [
    {
      name: 'Base',
      description: 'base',
      tags: ['base'],
      rules: [{ description: 'A cache needs its host', conditions: [{ name: 'Cache', state: RuleState.Set }], targets: [{ name: 'CacheHost', state: RuleState.Set }] }],
    },
    {
      name: 'Strict',
      description: 'contradicts the rule it inherits',
      tags: ['strict'],
      extends: 'Base',
      rules: [{ description: 'A cache never has a host', conditions: [{ name: 'Cache', state: RuleState.Set }], targets: [{ name: 'CacheHost', state: RuleState.Set, not: true }] }],
    },
  ],
};

describe('template validation', () => {
  it('validates every ruleset unless one is named', () => {
    expect(selectRuleSets(template, {}).map((rs) => rs.name)).toEqual(['Base', 'Strict']);
    expect(selectRuleSets(template, { rulesetName: 'strict' }).map((rs) => rs.name)).toEqual(['Strict']);
    expect(selectRuleSets(template, { tag: 'base' }).map((rs) => rs.name)).toEqual(['Base']);
  });

  it('checks a ruleset together with the rules it inherits', () => {
    expect(validateTemplateRuleSet(template, template.ruleSets[0]).errors).toEqual([]);
    expect(validateTemplateRuleSet(template, template.ruleSets[1]).errors.length).toBeGreaterThan(0);
  });
});
