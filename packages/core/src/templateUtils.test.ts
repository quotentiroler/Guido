import { describe, it, expect } from 'vitest';
import type { Field } from '@quotentiroler/guido-types';
import { validateFieldSamples } from './index.js';

const field = (name: string, range: string, example: string, value: Field['value'] = ''): Field => ({
  name,
  value,
  info: name,
  example,
  range,
});

describe('validateFieldSamples', () => {
  it('flags an example outside its range', () => {
    const issues = validateFieldSamples([field('PORT', 'integer(1..65535)', '70000')]);
    expect(issues).toEqual([expect.objectContaining({ field: 'PORT', property: 'example', value: '70000' })]);
  });

  it('flags a default value outside its range', () => {
    const issues = validateFieldSamples([field('MODE', 'strict||lenient', 'strict', 'loose')]);
    expect(issues).toEqual([expect.objectContaining({ field: 'MODE', property: 'value', value: 'loose' })]);
  });

  it('accepts samples that fit, and empty ones as unset', () => {
    expect(
      validateFieldSamples([
        field('PORT', 'integer(1..65535)', '8080', 8080),
        field('URL', 'url', '', ''),
        field('FREE', '', 'anything', 'anything'),
      ])
    ).toEqual([]);
  });

  it('reads an example of an array-typed field as written in a flat file', () => {
    expect(validateFieldSamples([field('PROFILES', '(production||metrics)[]', 'production,metrics', ['production'])])).toEqual([]);
    expect(validateFieldSamples([field('PROFILES', '(production||metrics)[]', 'production,debug')])).toHaveLength(1);
  });
});
