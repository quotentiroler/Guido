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
