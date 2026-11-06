import { describe, it, expect } from 'vitest';
import type { ScanPattern } from '@quotentiroler/guido-types';
import { scanText } from './scan.js';

const names = (text: string, patterns: ScanPattern[]): string[] => [...scanText(text, patterns, 'f.ts').keys()].sort();

describe('scan presets', () => {
  it('process-env: member, index and destructuring reads', () => {
    const text = `
      const port = process.env.PORT;
      const url = process.env['BASE_URL'];
      const { LOG_LEVEL, NODE_ENV: mode = 'dev', ...rest } = process.env;
      const lower = process.env.npm_package_version;`;
    expect(names(text, ['process-env'])).toEqual(['BASE_URL', 'LOG_LEVEL', 'NODE_ENV', 'PORT']);
  });

  it('env-helper-call: quoted names inside xxxEnv(...) calls', () => {
    expect(names(`const t = positiveIntEnv('TIMEOUT_MS', 5000); boolEnv("FLAG")`, ['env-helper-call'])).toEqual(['FLAG', 'TIMEOUT_MS']);
  });

  it('workers-env: env, c.env, context.env, ctx.env and destructuring', () => {
    const text = `
      env.ISSUER; c.env.RESEND_API_KEY; context.env.CANONICAL_HOST; ctx.env['ANALYTICS_SITE'];
      const { MCP_RESOURCE, DB } = c.env;
      environment.NOT_THIS;`;
    expect(names(text, ['workers-env'])).toEqual(['ANALYTICS_SITE', 'CANONICAL_HOST', 'DB', 'ISSUER', 'MCP_RESOURCE', 'RESEND_API_KEY']);
  });

  it('import-meta-env, spring-placeholder and java-getenv', () => {
    expect(names('import.meta.env.VITE_API', ['import-meta-env'])).toEqual(['VITE_API']);
    expect(names('a.b=${DB_URL:jdbc:mysql://x}\nc=${JWT_SECRET}\nd=${lower.case}', ['spring-placeholder'])).toEqual(['DB_URL', 'JWT_SECRET']);
    expect(names('System.getenv("HOME_DIR")', ['java-getenv'])).toEqual(['HOME_DIR']);
  });

  it('raw regex with one capture group and extra flags', () => {
    expect(names('  PORT: z.number(),\n  MCP_ORIGIN: url,\nother: 1', [{ regex: '^\\s+([A-Z][A-Z0-9_]*):', flags: 'm' }])).toEqual(['MCP_ORIGIN', 'PORT']);
  });

  it('records the first file and line of each read', () => {
    const result = scanText('a\nprocess.env.PORT\nprocess.env.PORT', ['process-env'], 'src/a.ts');
    expect(result.get('PORT')).toEqual({ file: 'src/a.ts', line: 2 });
  });
});
