/**
 * @quotentiroler/guido-core - Configuration format registry
 *
 * The single place that knows how a Guido template becomes a config file and
 * back. Call sites (browser download, MCP export_config, CLI) dispatch here
 * instead of branching on file extension themselves.
 */

import { parse as parseJsonc, printParseErrorCode, type ParseError } from 'jsonc-parser';
import * as yaml from 'js-yaml';
import type { Field, FieldValue } from '@quotentiroler/guido-types';
import { fieldsToNestedObject, flattenObject, toFieldValues } from '../fieldUtils.js';
import { serializeIni, parseIni } from './ini.js';
import { serializeArgs, parseArgs, type ArgsSerializeOptions } from './args.js';
import { serializeKeyValue, parseKeyValueFormat } from './keyValue.js';
import { splitListValues } from './lists.js';

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

const DOTENV_VARIANT = /(?:^|[\\/])\.env\.[^./\\]+$/i;

/** Metadata for a format: MIME type, picker description and file extensions. */
export const formatMeta = (format: ConfigFormat): FormatMeta => FORMAT_META[format];

/**
 * Resolve a filename to a format, or `undefined` when the extension is unknown
 * so the caller can refuse rather than guess.
 *
 * @example
 * detectFormat('config.ini')          // 'ini'
 * detectFormat('run_nvidia_gpu.bat')  // 'args'
 * detectFormat('.env.production')     // 'env'
 */
export const detectFormat = (filename: string): ConfigFormat | undefined => {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return undefined;
  return EXTENSION_TO_FORMAT[filename.slice(dot).toLowerCase()] ?? (DOTENV_VARIANT.test(filename) ? 'env' : undefined);
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const flattenParsed = (parsed: unknown): Record<string, FieldValue> => {
  if (parsed === undefined || parsed === null) return {};
  if (!isRecord(parsed)) throw new Error('Settings document does not contain an object');
  return toFieldValues(flattenObject(parsed));
};

const parseJson = (content: string): unknown => {
  const errors: ParseError[] = [];
  const parsed: unknown = parseJsonc(content, errors, { allowTrailingComma: true });
  const [first] = errors;
  if (first) throw new Error(`Invalid JSON: ${printParseErrorCode(first.error)} at offset ${first.offset}`);
  return parsed;
};

const FLAT_FORMATS: ReadonlySet<ConfigFormat> = new Set(['ini', 'args', 'properties', 'env', 'txt']);

const parseDocument = (content: string, format: ConfigFormat): Record<string, FieldValue> => {
  switch (format) {
    case 'json':
      return flattenParsed(parseJson(content));
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

export interface ParseSettingsOptions {
  /** Template fields; values of array-typed fields in flat formats are read as comma lists. */
  fields?: readonly Field[];
}

/**
 * Parse configuration text into flat dot-notation settings. Throws on a malformed JSON or YAML document.
 *
 * @example
 * parseSettings('[default]\nsecurity_level = normal', 'ini')
 * // { 'default.security_level': 'normal' }
 */
export const parseSettings = (
  content: string,
  format: ConfigFormat,
  options: ParseSettingsOptions = {}
): Record<string, FieldValue> => {
  if (content.trim() === '') return {};
  const settings = parseDocument(content, format);
  return options.fields && FLAT_FORMATS.has(format) ? splitListValues(settings, options.fields) : settings;
};
