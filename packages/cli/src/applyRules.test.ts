import { describe, it, expect } from 'vitest';
import { type Template, RuleState } from '@quotentiroler/guido-types';
import { rulesToApply } from './applyRules.js';

const template: Template = {
  name: 'Env',
  fileName: '.env',
  version: '1.0.0',
  description: '',
  owner: '',
  fields: [],
  ruleSets: [
    { name: 'Base', description: '', tags: [], rules: [{ description: 'base', targets: [{ name: 'A', state: RuleState.Set }] }] },
    { name: 'Deployed', description: '', tags: [], extends: 'Base', rules: [{ description: 'deployed', targets: [{ name: 'B', state: RuleState.Set }] }] },
  ],
};

describe('rulesToApply', () => {
  it('applies the named ruleset together with the rules it inherits', () => {
    expect(rulesToApply(template, 'deployed').map((r) => r.description)).toEqual(['base', 'deployed']);
  });

  it('defaults to the first ruleset', () => {
    expect(rulesToApply(template).map((r) => r.description)).toEqual(['base']);
  });

  it('refuses an unknown ruleset', () => {
    expect(() => rulesToApply(template, 'Missing')).toThrow('Available: Base, Deployed');
  });
});
