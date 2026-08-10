/**
 * @guido/core - Command-line argument format
 *
 * Renders fields as the flag string a CLI actually takes, and reads one back.
 * A boolean field is a store_true flag: true emits `--flag`, false emits nothing,
 * which is how Guido's checked/unchecked state maps onto flags that either
 * appear or do not.
 */

import type { Field, FieldValue } from '@guido/types';

export interface ArgsSerializeOptions {
  /** Export only fields with `checked: true` (default: true). */
  onlyChecked?: boolean;
  /** Array values as consecutive values (`--f a b`) or a repeated flag (`--f a --f b`). */
  arrayStyle?: 'nargs' | 'repeat';
  /** Join flag and value with `=` instead of a space. */
  assign?: boolean;
}

interface Token {
  value: string;
  quoted: boolean;
}

const flagPrefix = (name: string): string => (name.length === 1 ? '-' : '--');

const needsQuoting = (value: string): boolean => value === '' || /[\s"']/.test(value);

const quote = (value: string): string => {
  if (!needsQuoting(value)) return value;
  // Only `"` and a trailing `\` need escaping: a trailing backslash would
  // otherwise escape the closing quote.
  return `"${value.replace(/"/g, '\\"').replace(/\\$/, '\\\\')}"`;
};

const scalarToString = (value: FieldValue): string => String(value ?? '');

/**
 * Serialize fields to a command-line argument string.
 *
 * @example
 * serializeArgs([{ name: 'lowvram', value: true, ... }, { name: 'port', value: 8188, ... }])
 * // '--lowvram --port 8188'
 */
export const serializeArgs = (fields: Field[], options: ArgsSerializeOptions = {}): string => {
  const { onlyChecked = true, arrayStyle = 'nargs', assign = false } = options;
  const exported = onlyChecked ? fields.filter((field) => field.checked) : fields;

  const parts: string[] = [];

  for (const field of exported) {
    const flag = `${flagPrefix(field.name)}${field.name}`;
    const { value } = field;

    if (typeof value === 'boolean') {
      if (value) parts.push(flag);
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const values = value.map((item) => quote(String(item)));
      if (arrayStyle === 'repeat' || assign) {
        parts.push(...values.map((item) => (assign ? `${flag}=${item}` : `${flag} ${item}`)));
      } else {
        parts.push(`${flag} ${values.join(' ')}`);
      }
      continue;
    }

    const rendered = quote(scalarToString(value));
    parts.push(assign ? `${flag}=${rendered}` : `${flag} ${rendered}`);
  }

  return parts.join(' ');
};

/** Split a command line into tokens, honouring single and double quotes. */
const tokenize = (content: string): Token[] => {
  const tokens: Token[] = [];
  let current = '';
  let quoteChar: '"' | "'" | null = null;
  let quotedToken = false;
  let started = false;

  const push = (): void => {
    if (started) tokens.push({ value: current, quoted: quotedToken });
    current = '';
    quotedToken = false;
    started = false;
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (quoteChar) {
      if (char === '\\' && quoteChar === '"' && (content[i + 1] === '"' || content[i + 1] === '\\')) {
        current += content[i + 1];
        i++;
        continue;
      }
      if (char === quoteChar) {
        quoteChar = null;
        continue;
      }
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quoteChar = char;
      quotedToken = true;
      started = true;
      continue;
    }

    if (/\s/.test(char)) {
      push();
      continue;
    }

    current += char;
    started = true;
  }

  push();
  return tokens;
};

const isFlag = (token: Token): boolean => {
  if (token.quoted) return false;
  const { value } = token;
  if (!value.startsWith('-') || value === '-' || value === '--') return false;
  // A negative number is a value, not a flag.
  return !/^-\.?\d/.test(value);
};

const stripDashes = (value: string): string => value.replace(/^--?/, '');

/**
 * Parse a command-line argument string into field values.
 * A flag with no value reads as `true`; a flag with several values, or one
 * repeated, reads as an array.
 *
 * @example
 * parseArgs('--lowvram --port 8188') // { lowvram: true, port: '8188' }
 */
export const parseArgs = (content: string): Record<string, FieldValue> => {
  const result: Record<string, FieldValue> = {};

  const assign = (name: string, value: FieldValue): void => {
    if (!(name in result)) {
      result[name] = value;
      return;
    }
    const previous = result[name];
    const toList = (input: FieldValue): string[] =>
      Array.isArray(input) ? input.map((item) => String(item)) : [String(input)];
    result[name] = [...toList(previous), ...toList(value)];
  };

  let pending: string | null = null;
  let values: string[] = [];

  const flush = (): void => {
    if (pending === null) return;
    if (values.length === 0) assign(pending, true);
    else if (values.length === 1) assign(pending, values[0]);
    else assign(pending, values);
    pending = null;
    values = [];
  };

  for (const token of tokenize(content)) {
    if (!token.quoted && token.value === '--') break;

    if (isFlag(token)) {
      flush();
      const equals = token.value.indexOf('=');
      if (equals > 0) {
        assign(stripDashes(token.value.slice(0, equals)), token.value.slice(equals + 1));
      } else {
        pending = stripDashes(token.value);
      }
      continue;
    }

    if (pending !== null) values.push(token.value);
  }

  flush();
  return result;
};
