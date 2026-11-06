import { parse as parseToml } from 'smol-toml';
import { parse as parseJsonc, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { toFieldValues } from '@quotentiroler/guido-core';
import { settingsFromValues, type ContractSettings } from '../settings.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseWranglerConfig = (content: string, file: string): Record<string, unknown> => {
  if (file.toLowerCase().endsWith('.toml')) return parseToml(content);
  const errors: ParseError[] = [];
  const parsed: unknown = parseJsonc(content, errors, { allowTrailingComma: true });
  if (errors.length > 0) throw new Error(`${file}: ${printParseErrorCode(errors[0].error)} at offset ${errors[0].offset}`);
  if (!isRecord(parsed)) throw new Error(`${file} does not contain an object`);
  return parsed;
};

/** Vars of the top level or of one named environment; wrangler does not inherit vars into an environment. */
export const readWranglerVars = (config: Record<string, unknown>, file: string, env?: string): ContractSettings => {
  let scope: unknown = config;
  if (env) {
    const environments = config.env;
    scope = isRecord(environments) ? environments[env] : undefined;
    if (!isRecord(scope)) throw new Error(`${file} has no environment "${env}"`);
  }
  const vars = isRecord(scope) ? scope.vars : undefined;
  return settingsFromValues(isRecord(vars) ? toFieldValues(vars) : {});
};

const NAMED_BINDING_LISTS: ReadonlySet<string> = new Set(['bindings', 'send_email', 'ratelimits', 'unsafe_bindings']);

/** Every binding name (KV, D1, R2, Durable Objects, services, queues, AI, ...) at the top level and in every environment. */
export const wranglerBindingNames = (config: Record<string, unknown>): Set<string> => {
  const names = new Set<string>();
  const visit = (node: unknown, parentKey: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, parentKey));
      return;
    }
    if (!isRecord(node)) return;
    if (typeof node.binding === 'string') names.add(node.binding);
    if (NAMED_BINDING_LISTS.has(parentKey) && typeof node.name === 'string') names.add(node.name);
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'vars') visit(value, key);
    }
  };
  visit(config, '');
  return names;
};
