/**
 * Import every built package entry the way a CONSUMER does.
 *
 * `moduleResolution: bundler` lets tsc accept extensionless relative imports and
 * emit them verbatim, which Node's ESM resolver rejects. That shipped once: the
 * published core could not be imported by Node at all, and nothing in this repo
 * noticed because the monorepo resolves to source.
 *
 * Run after build:packages, before publish.
 */
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENTRIES = [
  'packages/types/dist/index.js',
  'packages/types/dist/schemas.js',
  'packages/logger/dist/index.js',
  'packages/core/dist/index.js',
  'packages/mcp-server/dist/exports.js',
  'packages/mcp-server/dist/store/types.js',
  'packages/mcp-server/dist/store/memory-store.js',
  'packages/mcp-server/dist/store/change-tracker.js',
  'packages/mcp-server/dist/template-utils.js',
  'packages/cli/dist/index.js',
];

let failed = 0;

for (const entry of ENTRIES) {
  const absolute = resolve(entry);

  if (!existsSync(absolute)) {
    console.error(`MISSING  ${entry}`);
    failed++;
    continue;
  }

  try {
    await import(pathToFileURL(absolute).href);
    console.log(`ok       ${entry}`);
  } catch (error) {
    console.error(`FAILED   ${entry}\n         ${error.message}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} package entry point(s) cannot be imported by Node.`);
  process.exit(1);
}

console.log(`\nAll ${ENTRIES.length} entry points import cleanly.`);
