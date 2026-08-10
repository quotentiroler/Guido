import { describe, it, expect } from 'vitest';
import type { Field } from '@quotentiroler/guido-types';
import { serializeIni, parseIni } from './ini.js';

const f = (name: string, value: Field['value'], checked = true): Field => ({
  name,
  value,
  info: '',
  example: '',
  range: '',
  checked,
});

describe('serializeIni', () => {
  it('writes undotted names as root keys above every section', () => {
    const out = serializeIni([f('mode', 'fast'), f('default.security_level', 'normal')]);

    expect(out).toBe(['mode = fast', '', '[default]', 'security_level = normal'].join('\n'));
  });

  it('groups fields under one header per section, preserving field order', () => {
    const out = serializeIni([
      f('default.security_level', 'normal'),
      f('network.port', 8188),
      f('default.channel', 'stable'),
    ]);

    expect(out).toBe(
      [
        '[default]',
        'security_level = normal',
        'channel = stable',
        '',
        '[network]',
        'port = 8188',
      ].join('\n')
    );
  });

  it('treats only the first dot as the section boundary', () => {
    expect(serializeIni([f('a.b.c', 'x')])).toBe(['[a]', 'b.c = x'].join('\n'));
  });

  it('skips unchecked fields, and drops a section left empty by them', () => {
    const out = serializeIni([
      f('default.security_level', 'normal'),
      f('network.port', 8188, false),
    ]);

    expect(out).toBe(['[default]', 'security_level = normal'].join('\n'));
  });

  it('renders booleans, numbers and arrays', () => {
    const out = serializeIni([f('a.flag', true), f('a.off', false), f('a.n', 42), f('a.list', ['x', 'y'])]);

    expect(out).toBe(['[a]', 'flag = true', 'off = false', 'n = 42', 'list = x,y'].join('\n'));
  });

  it('escapes newlines, carriage returns and backslashes so one field stays one line', () => {
    const out = serializeIni([f('a.multi', 'first\nsecond'), f('a.path', 'C:\\tmp')]);

    expect(out).toBe(['[a]', 'multi = first\\nsecond', 'path = C:\\\\tmp'].join('\n'));
    expect(out.split('\n')).toHaveLength(3);
  });

  it('honours onlyChecked=false', () => {
    const out = serializeIni([f('a.b', '1', false)], { onlyChecked: false });

    expect(out).toBe(['[a]', 'b = 1'].join('\n'));
  });

  it('returns an empty string when nothing is exportable', () => {
    expect(serializeIni([])).toBe('');
    expect(serializeIni([f('a.b', '1', false)])).toBe('');
  });
});

describe('parseIni', () => {
  it('prefixes keys with their section', () => {
    expect(parseIni('[default]\nsecurity_level = normal')).toEqual({
      'default.security_level': 'normal',
    });
  });

  it('keeps keys seen before any section header undotted', () => {
    expect(parseIni('mode = fast\n[a]\nb = 1')).toEqual({ mode: 'fast', 'a.b': '1' });
  });

  it('ignores blank lines and both comment styles', () => {
    const content = ['; a comment', '# another', '', '[a]', '  ; indented comment', 'b = 1'].join('\n');

    expect(parseIni(content)).toEqual({ 'a.b': '1' });
  });

  it('splits on the first equals sign only', () => {
    expect(parseIni('[a]\nurl = http://h/?x=1&y=2')).toEqual({ 'a.url': 'http://h/?x=1&y=2' });
  });

  it('strips matching surrounding quotes', () => {
    expect(parseIni('[a]\nb = "  spaced  "\nc = \'q\'')).toEqual({
      'a.b': '  spaced  ',
      'a.c': 'q',
    });
  });

  it('unescapes newlines, carriage returns and backslashes', () => {
    expect(parseIni('[a]\nmulti = first\\nsecond\npath = C:\\\\tmp')).toEqual({
      'a.multi': 'first\nsecond',
      'a.path': 'C:\\tmp',
    });
  });

  it('ignores lines that are not assignments', () => {
    expect(parseIni('[a]\ngarbage line\nb = 1')).toEqual({ 'a.b': '1' });
  });

  it('accepts a key with an empty value', () => {
    expect(parseIni('[a]\nb =')).toEqual({ 'a.b': '' });
  });

  it('reads ComfyUI-Manager config.ini as written by its docs', () => {
    expect(parseIni('[default]\nsecurity_level = normal\n')).toEqual({
      'default.security_level': 'normal',
    });
  });
});

describe('ini round trip', () => {
  const fields = [
    f('mode', 'fast'),
    f('default.security_level', 'normal'),
    f('default.note', 'line one\nline two'),
    f('default.path', 'C:\\ComfyUI'),
    f('network.port', 8188),
    f('network.listen', true),
  ];

  it('serialize -> parse recovers every key and its string value', () => {
    expect(parseIni(serializeIni(fields))).toEqual({
      mode: 'fast',
      'default.security_level': 'normal',
      'default.note': 'line one\nline two',
      'default.path': 'C:\\ComfyUI',
      'network.port': '8188',
      'network.listen': 'true',
    });
  });

  it('is a fixed point: serialize -> parse -> serialize returns the same text', () => {
    const once = serializeIni(fields);
    const reparsed = Object.entries(parseIni(once)).map(([name, value]) => f(name, value));

    expect(serializeIni(reparsed)).toBe(once);
  });
});
