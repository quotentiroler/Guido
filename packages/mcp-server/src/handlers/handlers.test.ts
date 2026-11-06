import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuleState, type Field, type Rule, type Template } from '@quotentiroler/guido-types';
import { templateToolHandlers } from './index.js';
import type { ToolArgs } from './args.js';

function field(name: string, value: Field['value'] = '', overrides: Partial<Field> = {}): Field {
  return { name, value, info: '', example: '', range: 'string', ...overrides };
}

function template(overrides: Partial<Template> = {}): Template {
  return {
    name: 'Test',
    fileName: 'test.guido.json',
    version: '1.0.0',
    description: '',
    owner: '',
    fields: [],
    ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
    ...overrides,
  };
}

function withRules(rules: Rule[], fields: Field[] = []): Template {
  return template({ fields, ruleSets: [{ name: 'Default', description: '', tags: [], rules }] });
}

async function run(name: string, args: ToolArgs, tpl: Template) {
  const handler = templateToolHandlers[name];
  if (!handler) throw new Error(`no handler ${name}`);
  let saved = 0;
  const result: unknown = await handler(args, tpl, { filePath: 'test.guido.json', save: () => { saved++; } });
  return { result, saved };
}

const set = (name: string): Rule['targets'][number] => ({ name, state: RuleState.Set });

describe('field handlers', () => {
  it('list_fields honours filter, onlyChecked and limit', async () => {
    const tpl = template({
      fields: [field('db.host', 'a', { checked: true }), field('db.port', 1), field('db.user', 'u', { checked: true }), field('log', 'x', { checked: true })],
    });
    const { result } = await run('list_fields', { filter: 'DB', onlyChecked: true, limit: 1 }, tpl);
    expect(result).toEqual([{ name: 'db.host', value: 'a', checked: true, info: '', range: 'string' }]);
  });

  it('get_field throws for an unknown field', async () => {
    await expect(run('get_field', { name: 'missing' }, template())).rejects.toThrow('Field "missing" not found');
  });

  it('set_field updates value and metadata, applies rules and saves', async () => {
    const tpl = withRules([{ conditions: [set('a')], targets: [set('b')] }], [field('a'), field('b')]);
    const { result, saved } = await run('set_field', { name: 'a', value: 'on', checked: true, info: 'doc', link: 'https://x' }, tpl);
    expect(saved).toBe(1);
    expect(tpl.fields[0]).toMatchObject({ value: 'on', checked: true, info: 'doc', link: 'https://x' });
    expect(tpl.fields[1].checked).toBe(true);
    expect(result).toMatchObject({ success: true, field: { name: 'a', value: 'on', checked: true } });
  });

  it('set_field rejects an argument of the wrong type', async () => {
    const tpl = template({ fields: [field('a')] });
    await expect(run('set_field', { name: 'a', checked: 'yes' }, tpl)).rejects.toThrow('Invalid argument "checked"');
  });

  it('set_fields reports unknown fields without failing the batch', async () => {
    const tpl = template({ fields: [field('a')] });
    const { result } = await run('set_fields', { updates: [{ name: 'a', value: 2 }, { name: 'nope', checked: true }] }, tpl);
    expect(tpl.fields[0].value).toBe(2);
    expect(result).toMatchObject({ results: [{ name: 'a', updated: true }, { name: 'nope', updated: false }] });
  });

  it('add_field inserts after a named field and refuses duplicates', async () => {
    const tpl = template({ fields: [field('a'), field('c')] });
    await run('add_field', { field: field('b'), insertAfter: 'a' }, tpl);
    expect(tpl.fields.map(f => f.name)).toEqual(['a', 'b', 'c']);
    await expect(run('add_field', { field: field('a') }, tpl)).rejects.toThrow('already exists');
  });

  it('delete_field can remove the rules that reference it', async () => {
    const tpl = withRules([{ targets: [set('a')] }, { conditions: [set('b')], targets: [set('c')] }], [field('a'), field('b'), field('c')]);
    const { result } = await run('delete_field', { name: 'a', deleteRelatedRules: true }, tpl);
    expect(result).toEqual({ success: true, deletedField: 'a', deletedRules: 1 });
    expect(tpl.ruleSets[0].rules).toHaveLength(1);
  });
});

describe('rule handlers', () => {
  it('list_rules filters by field name with 1-based rule numbers', async () => {
    const tpl = withRules([{ targets: [set('a')] }, { conditions: [set('x')], targets: [set('b')] }]);
    const { result } = await run('list_rules', { filter: 'b' }, tpl);
    expect(result).toMatchObject({ ruleSet: 'Default', rules: [{ ruleNumber: 2 }] });
  });

  it('list_rules includes inherited rules on request', async () => {
    const tpl = template({
      ruleSets: [
        { name: 'Base', description: '', tags: [], rules: [{ targets: [set('a')] }] },
        { name: 'Child', description: '', tags: [], extends: 'Base', rules: [{ targets: [set('b')] }] },
      ],
    });
    const { result } = await run('list_rules', { ruleSetIndex: 1, includeInherited: true }, tpl);
    expect(result).toMatchObject({ ownRuleCount: 1, inheritedRuleCount: 1, rules: [{ inherited: true }, { inherited: false }] });
  });

  it('add_rule rolls back a rule that fails validation', async () => {
    const tpl = withRules([{ conditions: [set('a')], targets: [set('b')] }]);
    const contradicting = { conditions: [set('a')], targets: [{ name: 'b', state: RuleState.Set, not: true }] };
    await expect(run('add_rule', contradicting, tpl)).rejects.toThrow('Rule validation failed');
    expect(tpl.ruleSets[0].rules).toHaveLength(1);
  });

  it('update_rule and delete_rule address rules by 1-based number', async () => {
    const tpl = withRules([{ targets: [set('a')] }, { targets: [set('b')] }]);
    await run('update_rule', { ruleNumber: 2, description: 'second' }, tpl);
    expect(tpl.ruleSets[0].rules[1].description).toBe('second');
    const { result } = await run('delete_rule', { ruleNumber: 1 }, tpl);
    expect(result).toMatchObject({ success: true, deletedRuleNumber: 1 });
    expect(tpl.ruleSets[0].rules.map(r => r.description)).toEqual(['second']);
    await expect(run('delete_rule', { ruleNumber: 5 }, tpl)).rejects.toThrow('Rule 5 not found');
  });

  it('merge_rules combines rules with identical conditions', async () => {
    const tpl = withRules([{ conditions: [set('x')], targets: [set('a')] }, { conditions: [set('x')], targets: [set('b')] }]);
    await run('merge_rules', { ruleNumbers: [1, 2] }, tpl);
    expect(tpl.ruleSets[0].rules).toHaveLength(1);
    expect(tpl.ruleSets[0].rules[0].targets.map(t => t.name).sort()).toEqual(['a', 'b']);
  });
});

describe('ruleset handlers', () => {
  it('adds, renames and deletes rulesets', async () => {
    const tpl = template();
    await run('add_ruleset', { name: 'Prod', tags: ['deployed'] }, tpl);
    expect(tpl.ruleSets.map(r => r.name)).toEqual(['Default', 'Prod']);
    await run('update_ruleset', { index: 1, name: 'Production' }, tpl);
    expect(tpl.ruleSets[1].name).toBe('Production');
    await run('delete_ruleset', { index: 1 }, tpl);
    expect(tpl.ruleSets.map(r => r.name)).toEqual(['Default']);
  });
});

describe('template handlers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('get_template_info summarises the template', async () => {
    const { result } = await run('get_template_info', {}, withRules([{ targets: [set('a')] }], [field('a')]));
    expect(result).toMatchObject({ name: 'Test', fieldCount: 1, ruleSetCount: 1, ruleCount: 1 });
  });

  it('fetch_field_docs fetches the field link', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('docs body'))));
    const tpl = template({ fields: [field('a', '', { link: 'https://docs/a' })] });
    const { result } = await run('fetch_field_docs', { name: 'a' }, tpl);
    expect(result).toMatchObject({ success: true, fieldName: 'a', url: 'https://docs/a', content: 'docs body', truncated: false });
  });

  it('fetch_field_docs explains a missing link without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { result } = await run('fetch_field_docs', { name: 'a' }, template({ fields: [field('a')] }));
    expect(result).toMatchObject({ success: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('validation handlers', () => {
  it('validate_field checks a value against the field range', async () => {
    const tpl = template({ fields: [field('port', 80, { range: 'integer(1..100)' })] });
    const ok = await run('validate_field', { name: 'port' }, tpl);
    const bad = await run('validate_field', { name: 'port', value: 500 }, tpl);
    expect(ok.result).toMatchObject({ valid: true });
    expect(bad.result).toMatchObject({ valid: false });
  });
});
