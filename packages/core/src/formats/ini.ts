/**
 * @quotentiroler/guido-core - INI format
 *
 * Maps Guido's flat dot-notation field names onto INI's two-level
 * `[section] key = value` grammar: the first dot is the section boundary,
 * everything after it stays in the key.
 */

import type { Field, FieldValue } from '@quotentiroler/guido-types';

export interface IniSerializeOptions {
  /** Export only fields with `checked: true` (default: true). */
  onlyChecked?: boolean;
}

const escapeIniValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

const unescapeIniValue = (value: string): string =>
  value.replace(/\\(.)/g, (_match, char: string) => {
    if (char === 'n') return '\n';
    if (char === 'r') return '\r';
    return char;
  });

const stripSurroundingQuotes = (value: string): string => {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
};

const iniValueToString = (value: FieldValue): string => {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(',');
  return String(value ?? '');
};

/** Split `a.b.c` into section `a` and key `b.c`; an undotted name has no section. */
const splitSection = (name: string): { section: string; key: string } => {
  const dot = name.indexOf('.');
  if (dot <= 0) return { section: '', key: name };
  return { section: name.slice(0, dot), key: name.slice(dot + 1) };
};

/**
 * Serialize fields to INI text.
 *
 * @example
 * serializeIni([{ name: 'default.security_level', value: 'normal', ... }])
 * // '[default]\nsecurity_level = normal'
 */
export const serializeIni = (fields: Field[], options: IniSerializeOptions = {}): string => {
  const { onlyChecked = true } = options;
  const exported = onlyChecked ? fields.filter((field) => field.checked) : fields;

  const rootLines: string[] = [];
  const sections = new Map<string, string[]>();

  for (const field of exported) {
    const { section, key } = splitSection(field.name);
    const line = `${key} = ${escapeIniValue(iniValueToString(field.value))}`;

    if (!section) {
      rootLines.push(line);
      continue;
    }
    const existing = sections.get(section);
    if (existing) {
      existing.push(line);
    } else {
      sections.set(section, [line]);
    }
  }

  const blocks: string[] = [];
  if (rootLines.length > 0) blocks.push(rootLines.join('\n'));
  for (const [section, lines] of sections) {
    blocks.push([`[${section}]`, ...lines].join('\n'));
  }

  return blocks.join('\n\n');
};

/**
 * Parse INI text into flat dot-notation keys.
 * Keys appearing before the first section header stay undotted.
 *
 * @example
 * parseIni('[default]\nsecurity_level = normal')
 * // { 'default.security_level': 'normal' }
 */
export const parseIni = (content: string): Record<string, string> => {
  const result: Record<string, string> = {};
  let section = '';

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim();
      continue;
    }

    const equals = line.indexOf('=');
    if (equals < 1) continue;

    const key = line.slice(0, equals).trim();
    if (!key) continue;

    const value = unescapeIniValue(stripSurroundingQuotes(line.slice(equals + 1).trim()));
    result[section ? `${section}.${key}` : key] = value;
  }

  return result;
};
