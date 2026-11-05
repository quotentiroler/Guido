import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { type Field, type Rule, type Template, RuleState } from '@quotentiroler/guido-types';
import { applyRulesToFields } from './template-utils';
import { registerAllTools } from './dynamic-tools';
import { MemoryTemplateStore } from './store/memory-store';
import { InMemoryChangeTracker } from './store/change-tracker';
import type { ToolRegistrar, ToolResult } from './tools/types';

function createField(name: string, value: string | number | boolean = '', overrides: Partial<Field> = {}): Field {
  return { name, value, info: '', example: '', range: 'string', ...overrides };
}

function createTemplate(fields: Field[]): Template {
  return {
    name: 'Test Template',
    fileName: 'test.guido.json',
    version: '1.0.0',
    description: '',
    owner: '',
    fields,
    ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
  };
}

function setup(seed: Template) {
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<ToolResult>>();
  const server: ToolRegistrar = { registerTool: (name, _config, handler) => { handlers.set(name, handler); } };
  const tracker = new InMemoryChangeTracker();
  const store = new MemoryTemplateStore({ 't.json': seed }, tracker);
  store.setActiveRef('t.json');
  registerAllTools({ server, store, tracker });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const handler = handlers.get(name);
    if (!handler) throw new Error(`tool ${name} not registered`);
    const result = await handler(args);
    const json: unknown = result.isError ? undefined : JSON.parse(result.content[0].text);
    return { ...result, json };
  };
  return { call, store };
}

describe('registerAllTools', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('awaits async handlers before serialising the result', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('field docs'))));
    const { call } = setup(createTemplate([createField('a', '', { link: 'https://docs/a' })]));
    const { json } = await call('fetch_field_docs', { name: 'a' });
    expect(json).toMatchObject({ success: true, content: 'field docs' });
  });

  it('persists a handler change to the store', async () => {
    const { call, store } = setup(createTemplate([createField('a')]));
    await call('set_field', { name: 'a', value: 'x' });
    const saved = await store.load('t.json');
    expect(saved.fields[0].value).toBe('x');
  });

  it('validate_settings reports only fields the ruleset requires', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'guido-settings-'));
    const settingsPath = join(dir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ optional: 'x' }));
    const template = createTemplate([createField('optional'), createField('required'), createField('unused')]);
    template.ruleSets[0].rules = [{ targets: [{ name: 'required', state: RuleState.Set }] }];
    const { json } = await setup(template).call('validate_settings', { settingsPath });
    expect(json).toMatchObject({
      valid: false,
      issues: [{ field: 'required', type: 'missing' }],
      summary: { missingRequired: 1 },
    });
  });

  it('returns a handler error as an error result', async () => {
    const { call } = setup(createTemplate([]));
    const result = await call('get_field', { name: 'missing' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Field "missing" not found');
  });
});

describe('Rule Application Integration', () => {
  it('should apply rules when field is set', () => {
    const fields: Field[] = [
      createField('trigger', 'value', { checked: true }),
      createField('target', '', { checked: false }),
    ];
    const rules: Rule[] = [{
      conditions: [{ name: 'trigger', state: RuleState.Set }],
      targets: [{ name: 'target', state: RuleState.Set }],
    }];

    const { updatedFields, appliedRules } = applyRulesToFields(fields, rules);

    expect(updatedFields.find(f => f.name === 'target')?.checked).toBe(true);
    expect(appliedRules.length).toBeGreaterThan(0);
  });
});
