import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SetStateAction } from 'react';
import { RuleState, type Field, type RuleSet } from '@quotentiroler/guido-types';
import { GUIDO_TOOLS, executeToolCall, executeToolCalls, type GuidoToolContext } from '@/services/guidoTools';
import { isSharedTool } from '@/services/sharedTools';
import { UI_TOOLS } from '@/services/uiTools';

function field(name: string, overrides: Partial<Field> = {}): Field {
  return { name, value: '', info: '', example: '', range: 'string', ...overrides };
}

function apply<T extends unknown[]>(state: T, action: SetStateAction<T>): T {
  return typeof action === 'function' ? action(state) : action;
}

function harness(fields: Field[], ruleSets: RuleSet[], selectedRuleSetIndex = 0) {
  const state = { fields, ruleSets };
  const handleFieldChange = vi.fn((name: string, value: Field['value'], checked: boolean) => {
    state.fields = state.fields.map(f => (f.name === name ? { ...f, value, checked } : f));
  });
  const context: GuidoToolContext = {
    template: { name: 'T', fileName: 't.guido.json', version: '1', description: '', owner: '' },
    fields,
    ruleSets,
    selectedRuleSetIndex,
    handleFieldChange,
    setFields: action => { state.fields = apply(state.fields, action); },
    setRuleSets: action => { state.ruleSets = apply(state.ruleSets, action); },
  };
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await executeToolCall({ id: '1', name, arguments: args }, context);
    const json: unknown = result.isError ? undefined : JSON.parse(result.result);
    return { ...result, json };
  };
  return { state, call, handleFieldChange, context };
}

const ruleSet = (name: string, targets: string[]): RuleSet => ({
  name,
  description: '',
  tags: [],
  rules: targets.map(t => ({ targets: [{ name: t, state: RuleState.Set }] })),
});

describe('AI tool executor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has an executor for every advertised tool', () => {
    const missing = GUIDO_TOOLS.map(t => t.name).filter(name => !isSharedTool(name) && !(name in UI_TOOLS));
    expect(missing).toEqual([]);
  });

  it('fetch_field_docs accepts the advertised name argument', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('docs'))));
    const { call } = harness([field('db', { link: 'https://docs/db' })], [ruleSet('Default', [])]);
    const { json } = await call('fetch_field_docs', { name: 'db' });
    expect(json).toMatchObject({ success: true, content: 'docs' });
  });

  it('get_fields applies onlyChecked and limit', async () => {
    const { call } = harness([field('a', { checked: true }), field('b'), field('c', { checked: true })], [ruleSet('Default', [])]);
    const { json } = await call('get_fields', { onlyChecked: true, limit: 1 });
    expect(json).toEqual([expect.objectContaining({ name: 'a' })]);
  });

  it('delete_rule removes the advertised 1-based rule from the selected ruleset', async () => {
    const { state, call } = harness([], [ruleSet('Default', ['x']), ruleSet('Prod', ['a', 'b'])], 1);
    await call('delete_rule', { ruleNumber: 1 });
    expect(state.ruleSets[0].rules).toHaveLength(1);
    expect(state.ruleSets[1].rules.map(r => r.targets[0].name)).toEqual(['b']);
  });

  it('set_field records the value through history and keeps metadata edits', async () => {
    const { state, call, handleFieldChange } = harness([field('a', { checked: true })], [ruleSet('Default', [])]);
    await call('set_field', { name: 'a', value: 'on', info: 'what a does' });
    expect(handleFieldChange).toHaveBeenCalledWith('a', 'on', true, 'set_field');
    expect(state.fields[0]).toMatchObject({ value: 'on', info: 'what a does' });
  });

  it('add_rule keeps negated targets and rejects contradictions', async () => {
    const { state, call } = harness([], [ruleSet('Default', [])]);
    await call('add_rule', { conditions: [{ name: 'a', state: 'set' }], targets: [{ name: 'b', state: 'set', not: true }] });
    expect(state.ruleSets[0].rules[0].targets[0]).toMatchObject({ name: 'b', not: true });
    const clash = await call('add_rule', { conditions: [{ name: 'a', state: 'set' }], targets: [{ name: 'b', state: 'set' }] });
    expect(clash.isError).toBe(true);
  });

  it('keeps every change when one turn runs several mutating calls together', async () => {
    const { state, context } = harness([], [ruleSet('Default', [])]);
    await executeToolCalls([
      { id: '1', name: 'add_rule', arguments: { targets: [{ name: 'a', state: 'set' }] } },
      { id: '2', name: 'add_rule', arguments: { targets: [{ name: 'b', state: 'set' }] } },
    ], context);
    expect(state.ruleSets[0].rules.map(r => r.targets[0].name)).toEqual(['a', 'b']);
  });
});
