import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Field } from '@quotentiroler/guido-types';
import { loadSettings } from './cliIO.js';

const dir = mkdtempSync(join(tmpdir(), 'guido-cli-io-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const file = (name: string, content: string): string => {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
};

const field = (name: string, range: string): Field => ({ name, value: '', info: '', example: '', range });

describe('loadSettings', () => {
  it('reads every format the registry supports', () => {
    expect(loadSettings(file('config.ini', '[server]\nport = 8080\n'))).toEqual({ 'server.port': '8080' });
    expect(loadSettings(file('run.sh', '--port 8080 --verbose'))).toEqual({ port: '8080', verbose: true });
    expect(loadSettings(file('launch.args', '--port=8080'))).toEqual({ port: '8080' });
    expect(loadSettings(file('.env.example', 'PORT=8080\n'))).toEqual({ PORT: '8080' });
  });

  it('reads comma lists of array-typed fields from flat formats', () => {
    const fields = [field('SPRING_PROFILES_ACTIVE', '(production||metrics||debug)[]')];
    expect(loadSettings(file('app.properties', 'SPRING_PROFILES_ACTIVE=production,metrics\n'), fields)).toEqual({
      SPRING_PROFILES_ACTIVE: ['production', 'metrics'],
    });
  });

  it('refuses malformed JSON and an unknown extension', () => {
    expect(() => loadSettings(file('broken.json', '{"a": '))).toThrow(/Invalid JSON/);
    expect(() => loadSettings(file('settings.toml', 'a = 1'))).toThrow(/\.ini/);
  });
});
