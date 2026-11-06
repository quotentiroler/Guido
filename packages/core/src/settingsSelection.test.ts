import { describe, it, expect } from 'vitest';
import { type Template, RuleState } from '@quotentiroler/guido-types';
import { validateSettingsSelection } from './index.js';

const field = (name: string) => ({ name, value: '', info: name, example: '', range: 'string' });

const template: Template = {
  name: 'Workers',
  fileName: '.env',
  version: '1.0.0',
  description: 'workers',
  owner: 'test',
  fields: [field('PAGES_URL'), field('CRON_SCHEDULE')],
  ruleSets: [
    {
      name: 'Pages Beta',
      description: 'pages',
      tags: ['pages', 'beta'],
      rules: [{ targets: [{ name: 'PAGES_URL', state: RuleState.Set }] }],
    },
    {
      name: 'Cron Beta',
      description: 'cron',
      tags: ['cron', 'beta'],
      rules: [{ targets: [{ name: 'CRON_SCHEDULE', state: RuleState.Set }] }],
    },
  ],
};

const cronSettings = { CRON_SCHEDULE: '0 * * * *' };

describe('validateSettingsSelection', () => {
  it('validates against every ruleset a tag selects, not only the first', () => {
    const results = validateSettingsSelection(template, cronSettings, { tag: 'beta' });
    expect(results.map((r) => [r.ruleSet, r.passed])).toEqual([
      ['Pages Beta', false],
      ['Cron Beta', true],
    ]);
  });

  it('validates against the one ruleset a name selects', () => {
    expect(validateSettingsSelection(template, cronSettings, { rulesetName: 'cron beta' }).map((r) => r.ruleSet)).toEqual(['Cron Beta']);
  });

  it('falls back to the first ruleset without a selection', () => {
    expect(validateSettingsSelection(template, cronSettings, {}).map((r) => r.ruleSet)).toEqual(['Pages Beta']);
  });

  it('validates without rules when the template has no rulesets', () => {
    const results = validateSettingsSelection({ ...template, ruleSets: [] }, cronSettings, {});
    expect(results.map((r) => [r.ruleSet, r.passed])).toEqual([[null, true]]);
  });

  it('refuses a name or tag that selects nothing, listing what exists', () => {
    expect(() => validateSettingsSelection(template, cronSettings, { tag: 'prod' })).toThrow('Available tags: pages, beta, cron');
    expect(() => validateSettingsSelection(template, cronSettings, { rulesetName: 'Prod' })).toThrow('Available: Pages Beta, Cron Beta');
  });

  it('fails a valid result with warnings under strict mode', () => {
    const settings = { ...cronSettings, EXTRA: 'x' };
    const [lenient] = validateSettingsSelection(template, settings, { rulesetName: 'Cron Beta' });
    const [strict] = validateSettingsSelection(template, settings, { rulesetName: 'Cron Beta' }, { strict: true });
    expect([lenient.result.isValid, lenient.passed]).toEqual([true, true]);
    expect([strict.result.isValid, strict.passed]).toEqual([true, false]);
  });
});
