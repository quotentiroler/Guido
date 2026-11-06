/**
 * Check every package's exports the way a CONSUMER resolves them: each target
 * must exist, and each library entry must import under plain Node.
 * The source condition is skipped; it only resolves inside this monorepo.
 *
 * Run after build:packages, before publish.
 */
import { pathToFileURL } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SOURCE_CONDITION = '@quotentiroler/guido-source';
const PACKAGES_DIR = resolve('packages');

let failed = 0;
let checked = 0;

for (const dir of readdirSync(PACKAGES_DIR)) {
  const root = join(PACKAGES_DIR, dir);
  const manifestPath = join(root, 'package.json');
  if (!existsSync(manifestPath)) continue;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bins = new Set(Object.values(manifest.bin ?? {}).map((target) => resolve(root, target)));

  for (const [subpath, conditions] of Object.entries(manifest.exports ?? {})) {
    for (const [condition, target] of Object.entries(conditions)) {
      if (condition === SOURCE_CONDITION) continue;
      const label = `${manifest.name}${subpath.slice(1)} [${condition}]`;
      const absolute = resolve(root, target);
      checked++;

      if (!existsSync(absolute)) {
        console.error(`MISSING  ${label} -> ${target}`);
        failed++;
        continue;
      }

      if (condition !== 'default' || bins.has(absolute)) {
        console.log(`ok       ${label}`);
        continue;
      }

      try {
        await import(pathToFileURL(absolute).href);
        console.log(`ok       ${label} (imported)`);
      } catch (error) {
        console.error(`FAILED   ${label}\n         ${error.message}`);
        failed++;
      }
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${checked} export target(s) are broken for consumers.`);
  process.exit(1);
}

console.log(`\nAll ${checked} export targets resolve for consumers.`);
