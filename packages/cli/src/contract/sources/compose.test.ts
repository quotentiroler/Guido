import { describe, it, expect } from 'vitest';
import { interpolate, readComposeService } from './compose.js';
import { settingsFromValues, setDeployTime } from '../settings.js';

const compose = (environment: string): string => `services:\n  app:\n    image: x\n    environment:\n${environment}`;

describe('compose interpolation without an environment', () => {
  it.each([
    ['plain', { kind: 'value', value: 'plain' }],
    ['${PORT:-8080}', { kind: 'value', value: '8080' }],
    ['${PORT-8080}', { kind: 'value', value: '8080' }],
    ['${SECRET}', { kind: 'deploy-time' }],
    ['${SECRET:?required}', { kind: 'deploy-time' }],
    ['$SECRET', { kind: 'deploy-time' }],
    ['https://${HOST}/api', { kind: 'deploy-time' }],
    ['cost $$5', { kind: 'value', value: 'cost $5' }],
  ])('%s', (raw, expected) => {
    expect(interpolate(raw)).toEqual(expected);
  });
});

describe('compose interpolation from an environment', () => {
  const environment = settingsFromValues({ HOST: 'api.example.org', EMPTY: '' });
  setDeployTime(environment, 'TOKEN');

  it.each([
    ['https://${HOST}', { kind: 'value', value: 'https://api.example.org' }],
    ['${MISSING}', { kind: 'value', value: '' }],
    ['${MISSING:-d}', { kind: 'value', value: 'd' }],
    ['${EMPTY:-d}', { kind: 'value', value: 'd' }],
    ['${EMPTY-d}', { kind: 'value', value: '' }],
    ['${TOKEN:-d}', { kind: 'deploy-time' }],
    ['${TOKEN:+on}', { kind: 'value', value: 'on' }],
    ['${MISSING:+on}', { kind: 'value', value: '' }],
    ['${MISSING:?needed}', { kind: 'unset' }],
  ])('%s', (raw, expected) => {
    expect(interpolate(raw, environment)).toEqual(expected);
  });
});

describe('readComposeService', () => {
  it('reads the map form with deploy-time references and pass-through keys', () => {
    const settings = readComposeService(compose('      PORT: 8080\n      TOKEN: ${TOKEN}\n      FROM_SHELL:\n      MODE: ${MODE:-dev}\n'), 'c.yml', 'app');
    expect(settings.values).toEqual({ PORT: '8080', MODE: 'dev' });
    expect([...settings.deployTime]).toEqual(['TOKEN', 'FROM_SHELL']);
  });

  it('reads the list form', () => {
    const settings = readComposeService(compose('      - PORT=8080\n      - URL=a=b\n      - FROM_SHELL\n'), 'c.yml', 'app');
    expect(settings.values).toEqual({ PORT: '8080', URL: 'a=b' });
    expect([...settings.deployTime]).toEqual(['FROM_SHELL']);
  });

  it('resolves references and pass-through keys from an interpolation environment', () => {
    const environment = settingsFromValues({});
    setDeployTime(environment, 'TOKEN');
    const settings = readComposeService(compose('      TOKEN: ${TOKEN}\n      MISSING: ${MISSING}\n      FROM_SHELL:\n'), 'c.yml', 'app', environment);
    expect(settings.values).toEqual({ MISSING: '' });
    expect([...settings.deployTime]).toEqual(['TOKEN']);
  });

  it('names a missing service or environment', () => {
    expect(() => readComposeService(compose('      A: b\n'), 'c.yml', 'other')).toThrow('no service "other"');
    expect(() => readComposeService('services:\n  app:\n    image: x\n', 'c.yml', 'app')).toThrow('no environment');
  });
});
