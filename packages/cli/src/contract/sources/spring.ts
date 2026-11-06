import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseSettings, type ConfigFormat } from '@quotentiroler/guido-core';
import type { FieldValue } from '@quotentiroler/guido-types';
import { emptySettings, setValue, unset, type ContractSettings } from '../settings.js';

const PLACEHOLDER = /\$\{([A-Z][A-Z0-9_]*)(?::([^}]*))?\}/g;

const SPRING_FILES: readonly [string, ConfigFormat][] = [
  ['properties', 'properties'],
  ['yml', 'yaml'],
  ['yaml', 'yaml'],
];

export interface SpringOptions {
  dir: string;
  name?: string;
  profiles?: readonly string[];
  profileVariable?: string | false;
}

const readLayer = (dir: string, baseName: string): Record<string, FieldValue> => {
  const values: Record<string, FieldValue> = {};
  for (const [extension, format] of SPRING_FILES) {
    const path = join(dir, `${baseName}.${extension}`);
    if (existsSync(path)) Object.assign(values, parseSettings(readFileSync(path, 'utf-8'), format));
  }
  return values;
};

const asText = (value: FieldValue): string => (Array.isArray(value) ? value.join(',') : String(value));

/**
 * The environment variables a Spring config reads, as the layered profiles leave them:
 * `${VAR:default}` supplies default, `${VAR}` and `${VAR:}` leave VAR unset.
 */
export const readSpring = ({ dir, name = 'application', profiles = [], profileVariable = 'SPRING_PROFILES_ACTIVE' }: SpringOptions): ContractSettings => {
  const layers = [name, ...profiles.map((profile) => `${name}-${profile}`)];
  if (!layers.some((layer) => SPRING_FILES.some(([extension]) => existsSync(join(dir, `${layer}.${extension}`))))) {
    throw new Error(`No ${name}.properties or ${name}.yml in ${dir}`);
  }
  const properties = new Map<string, FieldValue>();
  layers.forEach((layer) => Object.entries(readLayer(dir, layer)).forEach(([key, value]) => properties.set(key, value)));

  const settings = emptySettings();
  if (profileVariable) setValue(settings, profileVariable, profiles.join(',') || 'default');
  for (const value of properties.values()) {
    for (const [, variable, fallback] of asText(value).matchAll(PLACEHOLDER)) {
      if (fallback) setValue(settings, variable, fallback);
      else unset(settings, variable);
    }
  }
  return settings;
};
