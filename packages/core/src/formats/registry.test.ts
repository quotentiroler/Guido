import { describe, it, expect } from 'vitest';
import type { Field } from '@quotentiroler/guido-types';
import { serializeFields, parseSettings, detectFormat, formatMeta, CONFIG_FORMATS } from './registry.js';

const f = (name: string, value: Field['value'], checked = true): Field => ({
  name,
  value,
  info: '',
  example: '',
  range: '',
  checked,
});

const fixture: Field[] = [
  f('Server.Host', 'localhost'),
  f('Server.Port', 8188),
  f('Server.Tls', false),
  f('Secret', 'hidden', false),
];

describe('detectFormat', () => {
  it.each([
    ['appsettings.json', 'json'],
    ['extra_model_paths.yaml', 'yaml'],
    ['config.yml', 'yaml'],
    ['config.ini', 'ini'],
    ['run_nvidia_gpu.bat', 'args'],
    ['start.cmd', 'args'],
    ['start.sh', 'args'],
    ['launch.args', 'args'],
    ['.env', 'env'],
    ['app.properties', 'properties'],
    ['notes.txt', 'txt'],
  ])('maps %s to %s', (filename, expected) => {
    expect(detectFormat(filename)).toBe(expected);
  });

  it.each(['.env.example', '.env.local', '.env.production'])('reads the dotenv variant %s as env', (filename) => {
    expect(detectFormat(filename)).toBe('env');
  });

  it('is case insensitive', () => {
    expect(detectFormat('CONFIG.INI')).toBe('ini');
  });

  it('returns undefined for an unknown extension so callers can refuse', () => {
    expect(detectFormat('archive.tar.gz')).toBeUndefined();
    expect(detectFormat('noextension')).toBeUndefined();
  });
});

describe('formatMeta', () => {
  it('describes every registered format for the file picker', () => {
    for (const format of CONFIG_FORMATS) {
      const meta = formatMeta(format);
      expect(meta.mimeType).toBeTruthy();
      expect(meta.description).toBeTruthy();
      expect(meta.extensions.length).toBeGreaterThan(0);
    }
  });

  it('round trips through detectFormat for each registered extension', () => {
    for (const format of CONFIG_FORMATS) {
      for (const ext of formatMeta(format).extensions) {
        expect(detectFormat(`config${ext}`)).toBe(format);
      }
    }
  });
});

describe('serializeFields', () => {
  it('nests dotted names for json and drops unchecked fields', () => {
    expect(serializeFields(fixture, 'json')).toBe(
      JSON.stringify({ Server: { Host: 'localhost', Port: 8188, Tls: false } }, null, 2)
    );
  });

  it('nests dotted names for yaml', () => {
    expect(serializeFields(fixture, 'yaml')).toBe('Server:\n  Host: localhost\n  Port: 8188\n  Tls: false\n');
  });

  it('writes flat dotted keys for properties', () => {
    expect(serializeFields(fixture, 'properties')).toBe(
      ['Server.Host=localhost', 'Server.Port=8188', 'Server.Tls=false'].join('\n')
    );
  });

  it('upper-snakes keys for env', () => {
    expect(serializeFields(fixture, 'env')).toBe(
      ['SERVER_HOST=localhost', 'SERVER_PORT=8188', 'SERVER_TLS=false'].join('\n')
    );
  });

  it('delegates ini and args to their own serializers', () => {
    expect(serializeFields(fixture, 'ini')).toBe(
      ['[Server]', 'Host = localhost', 'Port = 8188', 'Tls = false'].join('\n')
    );
    expect(serializeFields([f('cpu', true), f('port', 8188)], 'args')).toBe('--cpu --port 8188');
  });
});

describe('parseSettings', () => {
  it('flattens nested json and yaml to dotted keys', () => {
    expect(parseSettings('{"Server":{"Host":"localhost","Port":8188}}', 'json')).toEqual({
      'Server.Host': 'localhost',
      'Server.Port': 8188,
    });
    expect(parseSettings('Server:\n  Host: localhost\n', 'yaml')).toEqual({ 'Server.Host': 'localhost' });
  });

  it('reads key=value formats', () => {
    expect(parseSettings('A=1\n# comment\nB="two"', 'properties')).toEqual({ A: '1', B: 'two' });
  });

  it('reads ini and args through the same entry point', () => {
    expect(parseSettings('[default]\nsecurity_level = normal', 'ini')).toEqual({
      'default.security_level': 'normal',
    });
    expect(parseSettings('--cpu --port 8188', 'args')).toEqual({ cpu: true, port: '8188' });
  });

  it('returns an empty object for empty content in every format', () => {
    for (const format of CONFIG_FORMATS) {
      expect(parseSettings('', format)).toEqual({});
    }
  });
});

describe('parseSettings rejects a malformed document', () => {
  it('throws on invalid JSON instead of returning no settings', () => {
    expect(() => parseSettings('{"Server": ', 'json')).toThrow(/JSON/);
  });

  it('throws on a document that is not an object', () => {
    expect(() => parseSettings('["a"]', 'json')).toThrow(/object/);
    expect(() => parseSettings('- a\n- b\n', 'yaml')).toThrow(/object/);
  });

  it('still accepts comments and trailing commas in JSON', () => {
    expect(parseSettings('{\n  // note\n  "A": 1,\n}', 'json')).toEqual({ A: 1 });
  });
});

describe('parseSettings with template fields', () => {
  const typed = (name: string, range: string): Field => ({ ...f(name, ''), range });
  const fields = [typed('CRON_JOBS', '(a||b)[]'), typed('PORTS', 'integer[]'), typed('TAGS', 'string[1..]'), typed('NAME', 'string')];

  it('splits a comma list for an array-typed field read from a flat format', () => {
    expect(parseSettings('CRON_JOBS=a,b\nPORTS=80, 443\nTAGS=x\nNAME=x,y', 'env', { fields })).toEqual({
      CRON_JOBS: ['a', 'b'],
      PORTS: [80, 443],
      TAGS: ['x'],
      NAME: 'x,y',
    });
  });

  it.each(['properties', 'txt'] as const)('splits in %s too', (format) => {
    expect(parseSettings('CRON_JOBS=a, b', format, { fields })).toEqual({ CRON_JOBS: ['a', 'b'] });
  });

  it('splits ini and args values', () => {
    expect(parseSettings('CRON_JOBS = a,b', 'ini', { fields })).toEqual({ CRON_JOBS: ['a', 'b'] });
    expect(parseSettings('--CRON_JOBS a,b --PORTS 80 443', 'args', { fields })).toEqual({ CRON_JOBS: ['a', 'b'], PORTS: [80, 443] });
  });

  it('keeps a JSON array string and an empty value as written', () => {
    expect(parseSettings('CRON_JOBS=["a"]\nPORTS=', 'env', { fields })).toEqual({ CRON_JOBS: '["a"]', PORTS: '' });
  });

  it('leaves structured formats alone', () => {
    expect(parseSettings('{"CRON_JOBS":"a,b"}', 'json', { fields })).toEqual({ CRON_JOBS: 'a,b' });
  });
});
