import { describe, it, expect } from 'vitest';
import type { Field } from '@quotentiroler/guido-types';
import { serializeArgs, parseArgs } from './args.js';

const f = (name: string, value: Field['value'], checked = true): Field => ({
  name,
  value,
  info: '',
  example: '',
  range: '',
  checked,
});

describe('serializeArgs', () => {
  it('emits a bare flag for true and nothing at all for false', () => {
    expect(serializeArgs([f('lowvram', true), f('cpu', false)])).toBe('--lowvram');
  });

  it('emits flag and value for strings and numbers', () => {
    expect(serializeArgs([f('port', 8188), f('listen', '0.0.0.0')])).toBe('--port 8188 --listen 0.0.0.0');
  });

  it('uses a single dash for single-character names', () => {
    expect(serializeArgs([f('v', true)])).toBe('-v');
  });

  it('keeps the field name verbatim, including underscores', () => {
    expect(serializeArgs([f('fp8_e4m3fn-unet', true)])).toBe('--fp8_e4m3fn-unet');
  });

  it('quotes values containing whitespace or quotes, and the empty string', () => {
    expect(serializeArgs([f('output-directory', 'C:\\My Models')])).toBe('--output-directory "C:\\My Models"');
    expect(serializeArgs([f('title', 'say "hi"')])).toBe('--title "say \\"hi\\""');
    expect(serializeArgs([f('prefix', '')])).toBe('--prefix ""');
  });

  it('writes arrays as consecutive values by default', () => {
    expect(serializeArgs([f('whitelist-custom-nodes', ['a', 'b'])])).toBe('--whitelist-custom-nodes a b');
  });

  it('repeats the flag per value when arrayStyle is repeat', () => {
    expect(serializeArgs([f('feature-flag', ['a=1', 'b=2'])], { arrayStyle: 'repeat' })).toBe(
      '--feature-flag a=1 --feature-flag b=2'
    );
  });

  it('omits empty arrays entirely', () => {
    expect(serializeArgs([f('fast', []), f('cpu', true)])).toBe('--cpu');
  });

  it('uses --flag=value when assign is set', () => {
    expect(serializeArgs([f('port', 8188)], { assign: true })).toBe('--port=8188');
  });

  it('skips unchecked fields unless onlyChecked is false', () => {
    expect(serializeArgs([f('port', 8188, false), f('cpu', true)])).toBe('--cpu');
    expect(serializeArgs([f('port', 8188, false)], { onlyChecked: false })).toBe('--port 8188');
  });

  it('returns an empty string when nothing is exportable', () => {
    expect(serializeArgs([])).toBe('');
    expect(serializeArgs([f('cpu', false)])).toBe('');
  });
});

describe('parseArgs', () => {
  it('reads a flag with no value as true', () => {
    expect(parseArgs('--lowvram')).toEqual({ lowvram: true });
  });

  it('reads a flag followed by a value', () => {
    expect(parseArgs('--port 8188')).toEqual({ port: '8188' });
  });

  it('reads the --flag=value form', () => {
    expect(parseArgs('--port=8188')).toEqual({ port: '8188' });
  });

  it('reads short flags', () => {
    expect(parseArgs('-v -p 8188')).toEqual({ v: true, p: '8188' });
  });

  it('respects quoting when splitting tokens', () => {
    expect(parseArgs('--output-directory "C:\\My Models"')).toEqual({
      'output-directory': 'C:\\My Models',
    });
    expect(parseArgs("--title 'a b'")).toEqual({ title: 'a b' });
  });

  it('unescapes an escaped quote inside a quoted value', () => {
    expect(parseArgs('--title "say \\"hi\\""')).toEqual({ title: 'say "hi"' });
  });

  it('collects consecutive values after one flag into an array', () => {
    expect(parseArgs('--whitelist-custom-nodes a b')).toEqual({ 'whitelist-custom-nodes': ['a', 'b'] });
  });

  it('collects a repeated flag into an array', () => {
    expect(parseArgs('--feature-flag a=1 --feature-flag b=2')).toEqual({
      'feature-flag': ['a=1', 'b=2'],
    });
  });

  it('treats a negative number as a value, not a flag', () => {
    expect(parseArgs('--reserve-vram -1.5')).toEqual({ 'reserve-vram': '-1.5' });
  });

  it('ignores positional tokens before the first flag', () => {
    expect(parseArgs('python main.py --cpu')).toEqual({ cpu: true });
  });

  it('stops parsing at a bare --', () => {
    expect(parseArgs('--cpu -- --lowvram')).toEqual({ cpu: true });
  });

  it('collapses runs of whitespace, including newlines from a wrapped launcher line', () => {
    expect(parseArgs('--cpu \n  --port  8188')).toEqual({ cpu: true, port: '8188' });
  });

  it('returns an empty object for empty input', () => {
    expect(parseArgs('   ')).toEqual({});
  });
});

describe('args round trip', () => {
  const launcherLine = '--windows-standalone-build --lowvram --port 8188 --output-directory "C:\\My Outputs"';

  it('parse -> serialize reproduces a real ComfyUI launcher line', () => {
    const parsed = parseArgs(launcherLine);
    const fields = Object.entries(parsed).map(([name, value]) => f(name, value));

    expect(serializeArgs(fields)).toBe(launcherLine);
  });

  it('is a fixed point: parse -> serialize -> parse yields the same values', () => {
    const once = parseArgs(launcherLine);
    const fields = Object.entries(once).map(([name, value]) => f(name, value));

    expect(parseArgs(serializeArgs(fields))).toEqual(once);
  });
});
