import { readFileSync } from 'fs';
import { relative } from 'path';
import { globSync } from 'tinyglobby';
import type { ScanFiles, ScanPattern, ScanPreset } from '@quotentiroler/guido-types';

const NAME = '[A-Z][A-Z0-9_]*';
const QUOTED_NAME = new RegExp(`['"\`](${NAME})['"\`]`, 'g');

/** A pattern: each match yields the names in its first capture group, split by `names` when one group lists several. */
interface Matcher {
  regex: RegExp;
  names?: (captured: string) => string[];
}

const destructured = (captured: string): string[] =>
  captured
    .split(',')
    .map((part) => part.split(/[:=]/)[0].trim())
    .filter((name) => new RegExp(`^${NAME}$`).test(name));

const quotedNames = (captured: string): string[] => [...captured.matchAll(QUOTED_NAME)].map((match) => match[1]);

const PRESETS: Record<ScanPreset, readonly Matcher[]> = {
  'process-env': [
    { regex: new RegExp(`process\\.env\\.(${NAME})`, 'g') },
    { regex: new RegExp(`process\\.env\\[\\s*['"\`](${NAME})['"\`]\\s*\\]`, 'g') },
    { regex: /\{([^{}]*)\}\s*=\s*process\.env\b/g, names: destructured },
  ],
  'env-helper-call': [{ regex: /[A-Za-z]+Env\(([^)]*)\)/g, names: quotedNames }],
  'workers-env': [
    { regex: new RegExp(`\\benv\\.(${NAME})\\b`, 'g') },
    { regex: new RegExp(`\\benv\\[\\s*['"\`](${NAME})['"\`]\\s*\\]`, 'g') },
    { regex: /\{([^{}]*)\}\s*=\s*(?:[\w$]+\.)*env\b/g, names: destructured },
  ],
  'import-meta-env': [{ regex: new RegExp(`import\\.meta\\.env\\.(${NAME})`, 'g') }],
  'spring-placeholder': [{ regex: new RegExp(`\\$\\{(${NAME})(?::[^}]*)?\\}`, 'g') }],
  'java-getenv': [{ regex: new RegExp(`System\\.getenv\\(\\s*"(${NAME})"\\s*\\)`, 'g') }],
};

const toMatchers = (pattern: ScanPattern): readonly Matcher[] => {
  if (typeof pattern === 'string') return PRESETS[pattern];
  const flags = new Set([...(pattern.flags ?? ''), 'g']);
  return [{ regex: new RegExp(pattern.regex, [...flags].join('')) }];
};

export interface CodeRead {
  file: string;
  line: number;
}

/** Every variable name the matched files read, with the first place each is read. */
export type ScanResult = Map<string, CodeRead>;

const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length;

export const scanText = (text: string, patterns: readonly ScanPattern[], file: string, into: ScanResult = new Map()): ScanResult => {
  for (const { regex, names } of patterns.flatMap(toMatchers)) {
    for (const match of text.matchAll(regex)) {
      const captured = match[1];
      if (captured === undefined) continue;
      for (const name of names ? names(captured) : [captured]) {
        if (!into.has(name)) into.set(name, { file, line: lineAt(text, match.index) });
      }
    }
  }
  return into;
};

export const scanFiles = (root: string, groups: readonly ScanFiles[]): ScanResult => {
  const result: ScanResult = new Map();
  for (const group of groups) {
    const files = globSync(group.include, { cwd: root, ignore: ['**/node_modules/**', ...(group.exclude ?? [])], absolute: true });
    for (const file of files.sort()) {
      scanText(readFileSync(file, 'utf-8'), group.patterns, relative(root, file).replace(/\\/g, '/'), result);
    }
  }
  return result;
};
