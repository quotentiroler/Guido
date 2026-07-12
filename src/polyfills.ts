/**
 * Browser shims for Node globals that leak into the bundle through Node-oriented
 * dependencies (notably @vercel/oidc, pulled in by the AI SDK; also papaparse's worker
 * guard and interweave's SSR check). Those code paths are dead in the browser, but they
 * reference `process` / `global`, which are undefined here and throw
 * "process is not defined" at load.
 *
 * This module is imported FIRST in main.tsx so the globals exist before any dependency
 * module evaluates. Keep it dependency-free and side-effect only.
 */
const g = globalThis as Record<string, unknown>;

if (typeof g.global === 'undefined') {
  g.global = globalThis;
}

if (typeof g.process === 'undefined') {
  g.process = {
    env: {},
    argv: [],
    platform: 'browser',
    version: '',
    versions: {},
    cwd: () => '/',
  };
}

export {};
