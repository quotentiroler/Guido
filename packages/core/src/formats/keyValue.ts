/**
 * @quotentiroler/guido-core - Flat key=value formats (.properties, .env, .txt)
 */

import type { Field, FieldValue } from '@quotentiroler/guido-types';

export interface KeyValueSerializeOptions {
  /** Export only fields with `checked: true` (default: true). */
  onlyChecked?: boolean;
  /** `env` upper-snakes the key (`Server.Host` -> `SERVER_HOST`); `properties` keeps it verbatim. */
  style?: 'properties' | 'env';
}

const toEnvKey = (name: string): string => name.replace(/\./g, '_').toUpperCase();

const keyValueToString = (value: FieldValue): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value ?? '');
};

/**
 * Parse key=value content (.properties, .env, .txt).
 * Supports `#` and `//` comments and quoted values.
 *
 * @example
 * parseKeyValueFormat('KEY=value\n# comment\nOTHER="quoted"')
 * // { KEY: 'value', OTHER: 'quoted' }
 */
export const parseKeyValueFormat = (content: string): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) continue;

    const equalsIndex = trimmedLine.indexOf('=');
    if (equalsIndex > 0) {
      const key = trimmedLine.substring(0, equalsIndex).trim();
      let value = trimmedLine.substring(equalsIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }
  }

  return result;
};

/**
 * Serialize fields to flat key=value lines.
 *
 * @example
 * serializeKeyValue(fields, { style: 'env' }) // 'SERVER_HOST=localhost'
 */
export const serializeKeyValue = (
  fields: Field[],
  options: KeyValueSerializeOptions = {}
): string => {
  const { onlyChecked = true, style = 'properties' } = options;
  const exported = onlyChecked ? fields.filter((field) => field.checked) : fields;

  return exported
    .map((field) => {
      const key = style === 'env' ? toEnvKey(field.name) : field.name;
      return `${key}=${keyValueToString(field.value)}`;
    })
    .join('\n');
};
