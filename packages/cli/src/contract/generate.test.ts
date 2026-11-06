import { describe, it, expect } from 'vitest';
import { RuleState, type Field, type Template } from '@quotentiroler/guido-types';
import { docsSections, renderDocs, renderEnvExample, scaffoldDocs, templateSections } from './generate.js';

const field = (name: string, overrides: Partial<Field> = {}): Field => ({
  name,
  value: '',
  info: `${name} does things`,
  example: `${name.toLowerCase()}-example`,
  range: 'string',
  link: 'docs/env.md#core',
  ...overrides,
});

const template: Template = {
  name: 'App',
  fileName: '.env',
  version: '1',
  description: 'app',
  owner: 'test',
  fields: [
    field('BASE_URL', { value: 'http://localhost', info: 'Public URL | with <html> & pipes.' }),
    field('API_KEY', { secret: true, value: 'never-shown' }),
    field('ORIGINS', { value: ['a', 'b'], link: 'docs/env.md#network-and-cors' }),
    field('TOKEN', { secret: true, link: 'docs/env.md#network-and-cors' }),
  ],
  ruleSets: [
    { name: 'Base', description: '', tags: [], rules: [] },
    {
      name: 'Deployed',
      description: '',
      tags: [],
      extends: 'Base',
      rules: [{ targets: [{ name: 'BASE_URL', state: RuleState.Set }] }, { targets: [{ name: 'TOKEN', state: RuleState.Set }] }],
    },
  ],
};

const DOCS = [
  '# Env',
  '',
  'Prose stays.',
  '',
  '## Core',
  '',
  '<!-- guido:fields #core -->',
  'stale',
  '<!-- /guido:fields -->',
  '',
  '## Network',
  '',
  '<!-- guido:fields #network-and-cors -->',
  '<!-- /guido:fields -->',
  '',
].join('\r\n');

describe('renderDocs', () => {
  it('regenerates marked tables, escapes cells and never shows a secret default', () => {
    const docs = renderDocs(DOCS, template.fields);
    expect(docs).toContain('Prose stays.');
    expect(docs).toContain('| `BASE_URL` | Public URL \\| with &lt;html&gt; &amp; pipes. | `http://localhost` |');
    expect(docs).toContain('| `API_KEY` | API_KEY does things | *secret* |');
    expect(docs).toContain('| `ORIGINS` | ORIGINS does things | `a,b` |');
    expect(docs).not.toContain('never-shown');
    expect(docs).not.toContain('\r');
  });

  it('fails on a marker without fields and on fields without a marker', () => {
    expect(() => renderDocs(DOCS + '<!-- guido:fields #empty -->\n<!-- /guido:fields -->', template.fields)).toThrow('#empty has no template fields');
    expect(() => renderDocs('<!-- guido:fields #core -->\n<!-- /guido:fields -->', template.fields)).toThrow('#network-and-cors');
  });

  it('scaffolds a page that renders', () => {
    const scaffold = scaffoldDocs(template);
    expect(docsSections(scaffold)).toEqual([
      ['#core', 'Core'],
      ['#network-and-cors', 'Network and cors'],
    ]);
    expect(() => renderDocs(scaffold, template.fields)).not.toThrow();
  });
});

describe('renderEnvExample', () => {
  it('writes required fields with their example and the rest commented with defaults; secrets stay empty', () => {
    const env = renderEnvExample(template, { header: ['# App'], sections: docsSections(DOCS), requiredRuleset: 'Deployed', wrap: 20 });
    expect(env.split('\n')).toEqual([
      '# App',
      '',
      `# ── Core ${'─'.repeat(56)}`,
      '# Public URL | with',
      '# <html> & pipes.',
      'BASE_URL=base_url-example',
      '# API_KEY does things',
      '# API_KEY=',
      '',
      `# ── Network ${'─'.repeat(53)}`,
      '# ORIGINS does things',
      '# ORIGINS=a,b',
      '# TOKEN does things',
      'TOKEN=',
      '',
    ]);
  });

  it('uses anchors as sections without docs and rejects an unknown ruleset', () => {
    expect(templateSections(template).map(([, heading]) => heading)).toEqual(['Core', 'Network and cors']);
    expect(() => renderEnvExample(template, { header: [], sections: [], requiredRuleset: 'Nope' })).toThrow('"Nope"');
  });
});
