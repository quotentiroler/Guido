/**
 * @quotentiroler/guido-core - Configuration format registry
 *
 * The single place that knows how a Guido template becomes a config file and
 * back. Call sites (browser download, MCP export_config, CLI) dispatch here
 * instead of branching on file extension themselves.
 */

import { parse as parseJsonc } from 'jsonc-parser';
import * as yaml from 'js-yaml';
import type { Field, FieldValue } from '@quotentiroler/guido-types';
import { fieldsToNestedObject, flattenObject, toFieldValues } from '../fieldUtils.js';
import { serializeIni, parseIni } from './ini.js';
import { serializeArgs, parseArgs, type ArgsSerializeOptions } from './args.js';
import { serializeKeyValue, parseKeyValueFormat } from './keyValue.js';

export const CONFIG_FORMATS = ['json', 'yaml', 'ini', 'args', 'properties', 'env', 'txt'] as const;

export type ConfigFormat = (typeof CONFIG_FORMATS)[number];

export interface FormatMeta {
  mimeType: string;
  description: string;
  extensions: string[];
}

export interface SerializeOptions extends ArgsSerializeOptions {
  /** Export only fields with `checked: true` (default: true). */
  onlyChecked?: boolean;
}

const FORMAT_META: Record<ConfigFormat, FormatMeta> = {
  json: { mimeType: 'application/json', description: 'JSON Files', extensions: ['.json'] },
  yaml: { mimeType: 'application/x-yaml', description: 'YAML Files', extensions: ['.yaml', '.yml'] },
  ini: { mimeType: 'text/plain', description: 'INI Files', extensions: ['.ini'] },
  args: {
    mimeType: 'text/plain',
    description: 'Command-line Arguments',
    extensions: ['.args', '.bat', '.cmd', '.sh'],
  },
  properties: { mimeType: 'text/plain', description: 'Properties Files', extensions: ['.properties'] },
  env: { mimeType: 'text/plain', description: 'Environment Files', extensions: ['.env'] },
  txt: { mimeType: 'text/plain', description: 'Text Files', extensions: ['.txt'] },
};

const EXTENSION_TO_FORMAT: Record<string, ConfigFormat> = Object.fromEntries(
  CONFIG_FORMATS.flatMap((format) =>
    FORMAT_META[format].extensions.map((extension) => [extension, format])
  )
);

/** Metadata for a format: MIME type, picker description and file extensions. */
export const formatMeta = (format: ConfigFormat): FormatMeta => FORMAT_META[format];

/**
 * Resolve a filename to a format, or `undefined` when the extension is unknown
 * so the caller can refuse rather than guess.
 *
 * @example
 * detectFormat('config.ini')          // 'ini'
 * detectFormat('run_nvidia_gpu.bat')  // 'args'
 */
export const detectFormat = (filename: string): ConfigFormat | undefined => {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return undefined;
  return EXTENSION_TO_FORMAT[filename.slice(dot).toLowerCase()];
};

const selectFields = (fields: Field[], onlyChecked: boolean): Field[] =>
  onlyChecked ? fields.filter((field) => field.checked) : fields.map((field) => ({ ...field, checked: true }));

/**
 * Serialize fields to configuration text in the given format.
 *
 * @example
 * serializeFields(fields, 'ini')  // '[default]\nsecurity_level = normal'
 * serializeFields(fields, 'args') // '--lowvram --port 8188'
 */
export const serializeFields = (
  fields: Field[],
  format: ConfigFormat,
  options: SerializeOptions = {}
): string => {
  const { onlyChecked = true } = options;
  const selected = selectFields(fields, onlyChecked);

  switch (format) {
    case 'json':
      return JSON.stringify(fieldsToNestedObject(selected), null, 2);
    case 'yaml':
      return yaml.dump(fieldsToNestedObject(selected), { indent: 2, lineWidth: -1 });
    case 'ini':
      return serializeIni(selected);
    case 'args':
      return serializeArgs(selected, options);
    case 'env':
      return serializeKeyValue(selected, { style: 'env' });
    case 'properties':
    case 'txt':
      return serializeKeyValue(selected, { style: 'properties' });
  }
};

const flattenParsed = (parsed: unknown): Record<string, FieldValue> => {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  return toFieldValues(flattenObject(parsed as Record<string, unknown>));
};

/**
 * Parse configuration text into flat dot-notation settings.
 *
 * @example
 * parseSettings('[default]\nsecurity_level = normal', 'ini')
 * // { 'default.security_level': 'normal' }
 */
export const parseSettings = (content: string, format: ConfigFormat): Record<string, FieldValue> => {
  if (content.trim() === '') return {};

  switch (format) {
    case 'json':
      return flattenParsed(parseJsonc(content));
    case 'yaml':
      return flattenParsed(yaml.load(content));
    case 'ini':
      return parseIni(content);
    case 'args':
      return parseArgs(content);
    case 'env':
    case 'properties':
    case 'txt':
      return parseKeyValueFormat(content);
  }
};
