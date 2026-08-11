import { describe, it, expect } from 'vitest';
import { flattenObject, fieldsToNestedObject, toFieldValues } from './fieldUtils.js';
import type { Field, FieldValue } from '@quotentiroler/guido-types';

/**
 * flattenObject and fieldsToNestedObject are meant to be inverse. They were not
 * for arrays: flatten numbers items from 1 (`a.1`, `a.2`) while the rebuild
 * assigned at that literal index, leaving a hole at 0. A ComfyUI prompt round
 * tripped with every link turned from ["5", 0] into [null, "5", 0], which the
 * server rejects.
 */
const asFields = (flat: Record<string, FieldValue>): Field[] =>
  Object.entries(flat).map(([name, value]) => ({
    name,
    value,
    info: '',
    example: '',
    range: '',
    checked: true,
  }));

const roundTrip = (input: Record<string, unknown>): Record<string, unknown> =>
  fieldsToNestedObject(asFields(toFieldValues(flattenObject(input))));

describe('flatten/rebuild round trip', () => {
  it('preserves a flat object', () => {
    const input = { a: 1, b: 'two', c: true };

    expect(roundTrip(input)).toEqual(input);
  });

  it('preserves nesting', () => {
    const input = { server: { host: 'localhost', port: 8188 } };

    expect(roundTrip(input)).toEqual(input);
  });

  it('preserves an array of scalars without a leading hole', () => {
    const input = { paths: ['models/loras', 'models/lycoris'] };

    expect(roundTrip(input)).toEqual(input);
  });

  it('preserves a ComfyUI link, which is [nodeId, slot]', () => {
    const input = { '3': { inputs: { latent_image: ['5', 0] } } };

    expect(roundTrip(input)).toEqual(input);
  });

  it('preserves an array of objects', () => {
    const input = { images: [{ name: 'A', selected: true }, { name: 'B', selected: false }] };

    expect(roundTrip(input)).toEqual(input);
  });

  it('preserves a nested array inside an array item', () => {
    const input = { nodes: [{ links: ['a', 'b'] }] };

    expect(roundTrip(input)).toEqual(input);
  });

  it('keeps numeric OBJECT keys as an object, not an array', () => {
    // ComfyUI addresses nodes by numeric id at the top level.
    const input = { '3': { class_type: 'KSampler' }, '4': { class_type: 'VAEDecode' } };

    expect(roundTrip(input)).toEqual(input);
  });

  it('preserves a subgraph node id containing colons', () => {
    const input = { '2904:38': { inputs: { seed: 7 } } };

    expect(roundTrip(input)).toEqual(input);
  });

  it('round trips a whole small prompt graph unchanged', () => {
    const prompt = {
      '3': {
        class_type: 'KSampler',
        inputs: { seed: 8566257, steps: 20, model: ['4', 0], positive: ['6', 0] },
      },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'v1-5.safetensors' } },
    };

    expect(roundTrip(prompt)).toEqual(prompt);
  });

  it('does not leave a null in any rebuilt array', () => {
    const rebuilt = roundTrip({ a: [1, 2, 3], b: { c: ['x'] } });

    expect(JSON.stringify(rebuilt)).not.toContain('null');
  });
});
