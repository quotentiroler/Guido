import { describe, it, expect } from 'vitest';
import { parseRange } from './Field.js';

describe('parseRange', () => {
  it('reads (a||b)[] as an array of enum options', () => {
    expect(parseRange('(production||metrics)[]')).toEqual({
      rangeType: 'enum-array',
      options: ['production', 'metrics'],
      minSize: undefined,
      maxSize: undefined,
    });
  });

  it.each([
    ['(a||b)[1..]', 1, undefined],
    ['(a||b)[..2]', undefined, 2],
    ['(a||b)[1..2]', 1, 2],
  ])('reads %s with its size bounds', (range, minSize, maxSize) => {
    expect(parseRange(range)).toEqual({ rangeType: 'enum-array', options: ['a', 'b'], minSize, maxSize });
  });

  it('reads a plain || list as an enum', () => {
    expect(parseRange('debug||info||warn')).toEqual({ rangeType: 'enum', options: ['debug', 'info', 'warn'] });
  });

  it.each(['^(a||b)$', '^v[0-9]+||latest', 'x||y$'])('keeps the anchored regex %s a pattern', (range) => {
    expect(parseRange(range)).toEqual({ rangeType: 'pattern', regex: range });
  });

  it('still reads bounded and unbounded scalar arrays', () => {
    expect(parseRange('string[]')).toEqual({ rangeType: 'array', itemType: 'string' });
    expect(parseRange('integer[1..3]')).toEqual({ rangeType: 'array', itemType: 'integer', minSize: 1, maxSize: 3 });
  });
});
