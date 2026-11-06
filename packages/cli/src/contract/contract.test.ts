import { describe, it, expect, beforeEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { RuleState, type Template } from '@quotentiroler/guido-types';
import { githubAnnotation, loadContract, parseContractConfig, runContract } from './index.js';
import { parseContractArgs } from '../guidoContract.js';

const template: Template = {
  name: 'Shop',
  fileName: '.env',
  version: '1',
  description: 'shop',
  owner: 'test',
  fields: [
    { name: 'BASE_URL', value: 'http://localhost:3000', info: 'Public URL.', example: 'https://shop.example.org', range: 'url', link: 'docs/env.md#core' },
    { name: 'PORT', value: 3000, info: 'Port.', example: '3000', range: 'integer(1..65535)', link: 'docs/env.md#core' },
    { name: 'STRIPE_KEY', value: '', info: 'Stripe key.', example: 'sk_live_x', range: '^sk_(live|test)_\\w+$', link: 'docs/env.md#billing', secret: true },
  ],
  ruleSets: [
    {
      name: 'Deployed',
      description: '',
      tags: ['deployed'],
      rules: [
        { targets: [{ name: 'BASE_URL', state: RuleState.Set }] },
        { targets: [{ name: 'STRIPE_KEY', state: RuleState.Set }] },
      ],
    },
  ],
};

const config = {
  template: 'shop.guido.json',
  scan: { files: [{ include: ['src/**/*.ts'], exclude: ['**/*.test.ts'], patterns: ['process-env', 'workers-env'] }], ignoreBindingsFrom: ['wrangler.toml'] },
  generate: { docs: { path: 'docs/env.md' }, envExample: { path: '.env.example', requiredRuleset: 'Deployed' } },
  targets: [
    { name: 'example', source: { type: 'dotenv', path: '.env.example' }, ruleset: 'Deployed', strict: true },
    { name: 'prod', source: { type: 'compose', path: 'docker-compose.yml', service: 'web' }, tag: 'deployed', strict: true },
    { name: 'edge', source: { type: 'wrangler', path: 'wrangler.toml', env: 'production', secrets: { names: ['STRIPE_KEY'] } }, ruleset: 'Deployed' },
  ],
};

const FILES: Record<string, string> = {
  'shop.guido.json': JSON.stringify(template),
  'guido.contract.json': JSON.stringify(config),
  'docs/env.md': '# Env\r\n\r\n## Core\r\n\r\n<!-- guido:fields #core -->\r\n<!-- /guido:fields -->\r\n\r\n## Billing\r\n\r\n<!-- guido:fields #billing -->\r\n<!-- /guido:fields -->\r\n',
  'src/server.ts': 'const url = process.env.BASE_URL;\nconst port = Number(process.env.PORT);\n',
  'src/worker.ts': 'export default { fetch: (r, env) => env.CACHE.get(env.STRIPE_KEY) };\n',
  'src/server.test.ts': 'process.env.TEST_ONLY;\n',
  'docker-compose.yml': 'services:\n  web:\n    environment:\n      BASE_URL: ${BASE_URL:-https://shop.example.org}\n      PORT: "8080"\n      STRIPE_KEY: ${STRIPE_KEY}\n',
  'wrangler.toml': '[[kv_namespaces]]\nbinding = "CACHE"\n\n[env.production.vars]\nBASE_URL = "https://edge.example.org"\nPORT = 99999\n',
};

let root = '';
const read = (path: string): string => readFileSync(join(root, path), 'utf-8');
const write = (path: string, content: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const contract = () => loadContract(join(root, 'guido.contract.json'));
const messages = (command: 'check' | 'generate' | 'validate' | 'all', targets?: string[]): string[] =>
  runContract(contract(), command, { targets }).problems.map((p) => `${p.scope}: ${p.message}`);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'guido-contract-'));
  Object.entries(FILES).forEach(([path, content]) => write(path, content));
});

describe('guido-contract end to end', () => {
  it('generates docs and env example, keeping the docs line endings, then checks clean', () => {
    expect(messages('check')).toEqual([
      'generate: docs/env.md is stale: run guido-contract generate',
      'generate: .env.example is missing: run guido-contract generate',
    ]);
    expect(messages('generate')).toEqual([]);
    expect(read('docs/env.md')).toContain('| `STRIPE_KEY` | Stripe key. | *secret* |\r\n');
    expect(read('.env.example')).toBe(
      [
        '# Shop environment variables',
        '# Generated from shop.guido.json; edit the template, not this file.',
        '',
        `# ── Core ${'─'.repeat(56)}`,
        '# Public URL.',
        'BASE_URL=https://shop.example.org',
        '# Port.',
        '# PORT=3000',
        '',
        `# ── Billing ${'─'.repeat(53)}`,
        '# Stripe key.',
        'STRIPE_KEY=',
        '',
      ].join('\n')
    );
    expect(messages('check')).toEqual([]);
  });

  it('reports undeclared and unread variables, ignoring bindings and excluded files', () => {
    write('src/server.ts', 'process.env.BASE_URL; process.env.NEW_FLAG;');
    write('.env.example', '');
    runContract(contract(), 'generate');
    const problems = runContract(contract(), 'check').problems;
    expect(problems.map((p) => p.message)).toEqual([
      'NEW_FLAG is read by the code but missing from shop.guido.json',
      'in shop.guido.json but never read by the code: PORT',
    ]);
    expect(problems[0]).toMatchObject({ file: 'src/server.ts', line: 1 });
  });

  it('validates every target, treating deploy-time keys as present and never echoing a secret', () => {
    runContract(contract(), 'generate');
    const [example, edge, ...rest] = messages('validate');
    expect(example).toMatch(/^example vs Deployed: STRIPE_KEY: /);
    expect(edge).toMatch(/^edge vs Deployed: PORT: Value does not match expected range .*actual 99999\)$/);
    expect(rest).toEqual([]);
    write('docker-compose.yml', 'services:\n  web:\n    environment:\n      BASE_URL: ${BASE_URL}\n      STRIPE_KEY: pk_wrong\n      EXTRA: x\n');
    const prod = messages('validate', ['prod']);
    expect(prod).toEqual([expect.stringMatching(/^prod vs Deployed: STRIPE_KEY: Value does not match expected range \(expected [^,]*\)$/), 'prod vs Deployed: EXTRA: Field not defined in template']);
    expect(prod.join()).not.toContain('pk_wrong');
    expect(messages('validate', ['nope'])[0]).toContain('no target named "nope"');
  });

  it('formats GitHub annotations with file and line', () => {
    expect(githubAnnotation({ scope: 'scan', message: 'a, b: 50%', file: 'src/a.ts', line: 3 })).toBe('::error file=src/a.ts,line=3,title=scan::a, b: 50%25');
  });
});

describe('contract config and arguments', () => {
  it('rejects an invalid config with the failing path', () => {
    expect(() => parseContractConfig('{"template":"t.json","targets":[{"name":"x","source":{"type":"nope"}}]}', 'c.json')).toThrow('targets.0.source');
    expect(() => parseContractConfig('{"template":"t.json","targets":[{"name":"x","ruleset":"a","tag":"b","source":{"type":"dotenv","path":".env"}}]}', 'c.json')).toThrow('not both');
    expect(parseContractConfig('{ "template": "t.json", // comment\n }', 'c.json')).toEqual({ template: 't.json' });
  });

  it('parses commands, config and repeated targets', () => {
    expect(parseContractArgs(['validate', '--config', 'x.json', '--target', 'a', '-t', 'b'])).toEqual({ command: 'validate', configPath: 'x.json', targets: ['a', 'b'] });
    expect(parseContractArgs(['check'])).toEqual({ command: 'check', configPath: 'guido.contract.json', targets: [] });
    expect(parseContractArgs(['--help'])).toBeNull();
  });
});
