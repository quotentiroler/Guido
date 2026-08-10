import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { type Template } from '@guido/types';
import { type TemplateStore } from './types.js';
import { MemoryTemplateStore } from './memory-store.js';
import { FsTemplateStore } from './fs-store.js';
import { InMemoryChangeTracker } from './change-tracker.js';

const template = (name = 'Test'): Template => ({
  name,
  fileName: 'app.json',
  version: '1.0.0',
  description: '',
  owner: '',
  fields: [{ name: 'a', value: '1', info: '', example: '', range: '', checked: true }],
  ruleSets: [{ name: 'Default', description: '', tags: [], rules: [] }],
});

/**
 * Every adapter must satisfy this contract, so a tool written against the port
 * behaves identically on the filesystem and in a Worker.
 */
const contract = (label: string, makeStore: () => TemplateStore, makeRef: (n: string) => string) => {
  describe(`TemplateStore contract: ${label}`, () => {
    let store: TemplateStore;

    beforeEach(() => {
      store = makeStore();
    });

    it('round trips a template', async () => {
      const ref = makeRef('round-trip');
      await store.save(ref, template('Saved'));

      expect((await store.load(ref)).name).toBe('Saved');
    });

    it('reports existence', async () => {
      const ref = makeRef('exists');
      expect(await store.exists(ref)).toBe(false);

      await store.save(ref, template());
      expect(await store.exists(ref)).toBe(true);
    });

    it('throws a ref-bearing error when loading something absent', async () => {
      await expect(store.load(makeRef('missing'))).rejects.toThrow(/missing/);
    });

    it('adds a default ruleSet to a template stored without one', async () => {
      const ref = makeRef('no-rulesets');
      const bare = { ...template(), ruleSets: [] };
      await store.save(ref, bare);

      const loaded = await store.load(ref);
      expect(loaded.ruleSets).toHaveLength(1);
      expect(loaded.ruleSets?.[0].name).toBe('Default');
    });

    it('resolves an explicit ref over the active one', () => {
      const explicit = makeRef('explicit');
      store.setActiveRef(makeRef('active'));

      expect(store.resolveRef(explicit)).toBe(store.resolveRef(explicit));
      expect(store.resolveRef(explicit)).not.toBe(store.resolveRef());
    });

    it('falls back to the active ref and reports it', () => {
      const active = makeRef('active');
      expect(store.activeRef()).toBeUndefined();

      store.setActiveRef(active);
      expect(store.activeRef()).toBe(store.resolveRef());
      expect(store.resolveRef()).toBe(store.resolveRef(active));
    });

    it('refuses to resolve when neither an explicit nor an active ref exists', () => {
      expect(() => store.resolveRef()).toThrow(/no template/i);
    });

    it('isolates stored templates by ref', async () => {
      await store.save(makeRef('one'), template('One'));
      await store.save(makeRef('two'), template('Two'));

      expect((await store.load(makeRef('one'))).name).toBe('One');
      expect((await store.load(makeRef('two'))).name).toBe('Two');
    });
  });
};

contract('memory', () => new MemoryTemplateStore(), (n) => n);

describe('FsTemplateStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guido-store-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  contract('filesystem', () => new FsTemplateStore(), (n) => path.join(dir, `${n}.guido.json`));

  it('canonicalizes a relative ref to an absolute path', () => {
    const store = new FsTemplateStore();

    expect(path.isAbsolute(store.resolveRef('./a.guido.json'))).toBe(true);
  });

  it('writes indented JSON a human can diff', async () => {
    const store = new FsTemplateStore();
    const ref = path.join(dir, 'indent.guido.json');
    await store.save(ref, template());

    expect(fs.readFileSync(ref, 'utf-8')).toContain('\n  "name"');
  });
});

describe('MemoryTemplateStore', () => {
  it('seeds from a template so a stateless request can pass one in', async () => {
    const store = new MemoryTemplateStore({ inline: template('Inline') });

    expect((await store.load('inline')).name).toBe('Inline');
  });

  it('hands back everything it holds, for returning state to a stateless caller', async () => {
    const store = new MemoryTemplateStore();
    await store.save('a', template('A'));

    expect(Object.keys(store.entries())).toEqual(['a']);
    expect(store.entries().a.name).toBe('A');
  });

  it('does not leak mutations of a loaded template back into the store', async () => {
    const store = new MemoryTemplateStore({ a: template('A') });

    const loaded = await store.load('a');
    loaded.name = 'Mutated';

    expect((await store.load('a')).name).toBe('A');
  });
});

describe('InMemoryChangeTracker', () => {
  let tracker: InMemoryChangeTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    tracker = new InMemoryChangeTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records changes per ref in order', async () => {
    await tracker.record('a', 'field_add', { name: 'x' });
    await tracker.record('a', 'field_update', { name: 'y' });
    await tracker.record('b', 'field_add', { name: 'z' });

    const changes = await tracker.changes('a');
    expect(changes.map((c) => c.type)).toEqual(['field_add', 'field_update']);
    expect(changes[0].timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(await tracker.changes('b')).toHaveLength(1);
  });

  it('returns an empty log for an unknown ref', async () => {
    expect(await tracker.changes('never-touched')).toEqual([]);
  });

  it('clears one ref without touching another', async () => {
    await tracker.record('a', 'field_add', {});
    await tracker.record('b', 'field_add', {});

    await tracker.clear('a');

    expect(await tracker.changes('a')).toEqual([]);
    expect(await tracker.changes('b')).toHaveLength(1);
  });

  it('keeps the first snapshot and ignores later captures', async () => {
    await tracker.captureSnapshot('a', template('First'));
    await tracker.captureSnapshot('a', template('Second'));

    expect((await tracker.snapshot('a'))?.template.name).toBe('First');
  });

  it('deep copies the snapshot so later edits cannot rewrite history', async () => {
    const original = template('Original');
    await tracker.captureSnapshot('a', original);

    original.name = 'Edited';
    original.fields[0].value = 'changed';

    const snapshot = await tracker.snapshot('a');
    expect(snapshot?.template.name).toBe('Original');
    expect(snapshot?.template.fields[0].value).toBe('1');
  });
});
