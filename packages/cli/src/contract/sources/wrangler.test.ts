import { describe, it, expect } from 'vitest';
import { parseWranglerConfig, readWranglerVars, wranglerBindingNames } from './wrangler.js';

const TOML = `
name = "worker"

[[kv_namespaces]]
binding = "CACHE"
id = "x"

[[durable_objects.bindings]]
name = "ROOMS"
class_name = "Room"

[vars]
ISSUER = "https://auth.example.org"
RETRIES = 3

[env.beta]

[[env.beta.d1_databases]]
binding = "DB"
database_name = "beta"

[env.beta.vars]
ISSUER = "https://auth.beta.example.org"
`;

const JSONC = `{
  // comments and trailing commas are allowed
  "name": "worker",
  "ai": { "binding": "AI" },
  "vars": { "FLAGS": { "a": true }, },
}`;

describe('wrangler source', () => {
  it('reads top-level vars from toml', () => {
    expect(readWranglerVars(parseWranglerConfig(TOML, 'wrangler.toml'), 'wrangler.toml').values).toEqual({
      ISSUER: 'https://auth.example.org',
      RETRIES: 3,
    });
  });

  it('reads only the named environment vars, without inheriting the top level', () => {
    expect(readWranglerVars(parseWranglerConfig(TOML, 'wrangler.toml'), 'wrangler.toml', 'beta').values).toEqual({
      ISSUER: 'https://auth.beta.example.org',
    });
  });

  it('reads jsonc and keeps object vars as JSON text', () => {
    expect(readWranglerVars(parseWranglerConfig(JSONC, 'wrangler.jsonc'), 'wrangler.jsonc').values).toEqual({ FLAGS: '{"a":true}' });
  });

  it('rejects an unknown environment and invalid jsonc', () => {
    expect(() => readWranglerVars(parseWranglerConfig(TOML, 'w.toml'), 'w.toml', 'prod')).toThrow('no environment "prod"');
    expect(() => parseWranglerConfig('{ "a": ', 'w.json')).toThrow('w.json');
  });

  it('collects binding names from every environment', () => {
    expect([...wranglerBindingNames(parseWranglerConfig(TOML, 'w.toml'))].sort()).toEqual(['CACHE', 'DB', 'ROOMS']);
    expect([...wranglerBindingNames(parseWranglerConfig(JSONC, 'w.jsonc'))]).toEqual(['AI']);
  });
});
