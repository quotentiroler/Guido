import { basename } from 'path';
import { CONFIG_FORMATS, detectFormat, parseSettings, type ConfigFormat } from '@quotentiroler/guido-core';
import type { ContractSource } from '@quotentiroler/guido-types';
import {
  emptySettings,
  mergeSettings,
  readSecretNames,
  selectKeys,
  setDeployTime,
  settingsFromValues,
  withoutPrefixes,
  type ContractSettings,
  type SourceContext,
} from '../settings.js';
import { readComposeService } from './compose.js';
import { parseWranglerConfig, readWranglerVars } from './wrangler.js';
import { readSpring } from './spring.js';

const isConfigFormat = (value: string): value is ConfigFormat => CONFIG_FORMATS.some((format) => format === value);

const fileFormat = (path: string, format: string | undefined): ConfigFormat => {
  if (format !== undefined) {
    if (!isConfigFormat(format)) throw new Error(`Unknown format "${format}". Supported: ${CONFIG_FORMATS.join(', ')}`);
    return format;
  }
  const detected = detectFormat(basename(path));
  if (!detected) throw new Error(`Cannot detect the format of ${path}; set "format"`);
  return detected;
};

const readOwnSettings = (source: ContractSource, context: SourceContext): ContractSettings => {
  switch (source.type) {
    case 'dotenv':
      return settingsFromValues(parseSettings(context.read(source.path), 'env'));
    case 'file':
      return settingsFromValues(parseSettings(context.read(source.path), fileFormat(source.path, source.format)));
    case 'compose': {
      const environment = source.interpolate ? readSource(source.interpolate, context) : undefined;
      return readComposeService(context.read(source.path), source.path, source.service, environment);
    }
    case 'wrangler':
      return readWranglerVars(parseWranglerConfig(context.read(source.path), source.path), source.path, source.env);
    case 'spring':
      return readSpring({ ...source, dir: context.path(source.dir) });
    case 'secrets':
      return emptySettings();
    case 'values':
      return settingsFromValues(source.values);
    case 'merge':
      return mergeSettings(source.sources.map((layer) => readSource(layer, context)));
  }
};

/** A source's settings, with its secret names supplied at deploy time and excluded prefixes dropped. */
export function readSource(source: ContractSource, context: SourceContext): ContractSettings {
  const own = readOwnSettings(source, context);
  const settings = source.type !== 'secrets' && source.select ? selectKeys(own, source.select) : own;
  const secretNames = source.type === 'secrets' ? readSecretNames(source, context) : readSecretNames(source.secrets, context);
  secretNames.forEach((name) => setDeployTime(settings, name));
  return withoutPrefixes(settings, source.excludePrefixes ?? []);
}

export const describeSource = (source: ContractSource): string => {
  switch (source.type) {
    case 'compose':
      return `${source.path} (${source.service})`;
    case 'wrangler':
      return source.env ? `${source.path} [env.${source.env}]` : source.path;
    case 'spring':
      return `${source.dir} (${source.profiles?.join(',') || 'default'})`;
    case 'secrets':
      return source.file ?? 'secret names';
    case 'values':
      return 'literal values';
    case 'merge':
      return source.sources.map(describeSource).join(' + ');
    default:
      return source.path;
  }
};
