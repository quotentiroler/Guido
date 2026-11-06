import { existsSync, readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import type { FieldValue, SecretNames } from '@quotentiroler/guido-types';

/** Settings a source supplies: known values, plus keys whose value is only supplied at deploy time. A key is in one or the other. */
export interface ContractSettings {
  values: Record<string, FieldValue>;
  deployTime: Set<string>;
}

export interface SourceContext {
  root: string;
  path(relative: string): string;
  read(relative: string): string;
}

export const createSourceContext = (root: string): SourceContext => {
  const path = (relative: string): string => (isAbsolute(relative) ? relative : resolve(root, relative));
  return {
    root,
    path,
    read: (relative) => {
      const absolute = path(relative);
      if (!existsSync(absolute)) throw new Error(`File not found: ${absolute}`);
      return readFileSync(absolute, 'utf-8');
    },
  };
};

export const emptySettings = (): ContractSettings => ({ values: {}, deployTime: new Set() });

export const setValue = (settings: ContractSettings, key: string, value: FieldValue): void => {
  settings.deployTime.delete(key);
  settings.values[key] = value;
};

export const setDeployTime = (settings: ContractSettings, key: string): void => {
  delete settings.values[key];
  settings.deployTime.add(key);
};

export const unset = (settings: ContractSettings, key: string): void => {
  delete settings.values[key];
  settings.deployTime.delete(key);
};

export const settingsFromValues = (values: Record<string, FieldValue>): ContractSettings => ({ values: { ...values }, deployTime: new Set() });

export const mergeSettings = (layers: readonly ContractSettings[]): ContractSettings => {
  const merged = emptySettings();
  for (const layer of layers) {
    Object.entries(layer.values).forEach(([key, value]) => setValue(merged, key, value));
    layer.deployTime.forEach((key) => setDeployTime(merged, key));
  }
  return merged;
};

export const settingsKeys = (settings: ContractSettings): string[] => [...Object.keys(settings.values), ...settings.deployTime];

export const withoutPrefixes = (settings: ContractSettings, prefixes: readonly string[]): ContractSettings => {
  const result = mergeSettings([settings]);
  for (const key of settingsKeys(result)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) unset(result, key);
  }
  return result;
};

/** Only the mapped keys, renamed from source key to contract key. */
export const selectKeys = (settings: ContractSettings, mapping: Readonly<Record<string, string>>): ContractSettings => {
  const result = emptySettings();
  for (const [from, to] of Object.entries(mapping)) {
    const value = settings.values[from];
    if (value !== undefined) setValue(result, to, value);
    else if (settings.deployTime.has(from)) setDeployTime(result, to);
  }
  return result;
};

const namesFromJson = (parsed: unknown): string[] | null => {
  if (!Array.isArray(parsed)) return null;
  return parsed.flatMap((entry: unknown) => {
    if (typeof entry === 'string') return [entry];
    if (typeof entry === 'object' && entry !== null && 'name' in entry && typeof entry.name === 'string') return [entry.name];
    return [];
  });
};

/** One name per line (# comments allowed), or JSON: an array of names or of `{ name }` as `wrangler secret list --format json` prints. */
export const parseSecretNames = (content: string): string[] => {
  const trimmed = content.trim();
  if (trimmed.startsWith('[')) {
    const names = namesFromJson(JSON.parse(trimmed));
    if (names) return names;
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
};

export const readSecretNames = (secrets: SecretNames | undefined, context: SourceContext): string[] => [
  ...(secrets?.names ?? []),
  ...(secrets?.file ? parseSecretNames(context.read(secrets.file)) : []),
];
