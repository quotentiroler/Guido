import { describe, it, expect } from 'vitest';
import { mergeSettings, parseSecretNames, selectKeys, setDeployTime, settingsFromValues, withoutPrefixes } from './settings.js';

describe('contract settings', () => {
  it('parses secret names from lines or wrangler JSON', () => {
    expect(parseSecretNames('# comment\nA\n\n B \r\nC')).toEqual(['A', 'B', 'C']);
    expect(parseSecretNames('[{"name":"RESEND_API_KEY","type":"secret_text"},"OTHER"]')).toEqual(['RESEND_API_KEY', 'OTHER']);
  });

  it('keeps a key either valued or deploy-time when layering', () => {
    const base = settingsFromValues({ A: '1', B: '2' });
    const secrets = settingsFromValues({});
    setDeployTime(secrets, 'A');
    const merged = mergeSettings([base, secrets, settingsFromValues({ B: '3' })]);
    expect(merged.values).toEqual({ B: '3' });
    expect([...merged.deployTime]).toEqual(['A']);
  });

  it('selects and renames keys and drops excluded prefixes', () => {
    const settings = settingsFromValues({ 'jobs.deploy.with.origin': 'https://x', other: 1, VITE_A: 'a' });
    setDeployTime(settings, 'token');
    expect(selectKeys(settings, { 'jobs.deploy.with.origin': 'ORIGIN', token: 'TOKEN', missing: 'MISSING' })).toEqual({
      values: { ORIGIN: 'https://x' },
      deployTime: new Set(['TOKEN']),
    });
    expect(withoutPrefixes(settings, ['VITE_', 'oth']).values).toEqual({ 'jobs.deploy.with.origin': 'https://x' });
  });
});
