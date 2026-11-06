import * as yaml from 'js-yaml';
import { emptySettings, setDeployTime, setValue, unset, type ContractSettings } from '../settings.js';

const REFERENCE = /\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?+])([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

type Lookup = { kind: 'value'; value: string } | { kind: 'deploy-time' } | { kind: 'absent' };
type Resolved = { kind: 'value'; value: string } | { kind: 'deploy-time' } | { kind: 'unset' };

/** Without an interpolation environment every variable is supplied at deploy time, unless the reference carries a default. */
const lookupIn = (environment: ContractSettings | undefined) => (name: string): Lookup => {
  if (!environment) return { kind: 'deploy-time' };
  if (environment.deployTime.has(name)) return { kind: 'deploy-time' };
  const value = environment.values[name];
  return value === undefined ? { kind: 'absent' } : { kind: 'value', value: Array.isArray(value) ? value.join(',') : String(value) };
};

const resolveReference = (found: Lookup, operator: string | undefined, operand: string, hasEnvironment: boolean): Resolved => {
  const emptyCounts = operator?.startsWith(':') ?? false;
  const isSet = found.kind === 'deploy-time' || (found.kind === 'value' && (!emptyCounts || found.value !== ''));
  switch (operator?.replace(':', '')) {
    case '-':
      if (!hasEnvironment) return { kind: 'value', value: operand };
      return isSet ? (found.kind === 'value' ? found : { kind: 'deploy-time' }) : { kind: 'value', value: operand };
    case '+':
      if (found.kind === 'deploy-time' && !hasEnvironment) return { kind: 'deploy-time' };
      return { kind: 'value', value: isSet ? operand : '' };
    case '?':
      if (found.kind === 'value' && isSet) return found;
      return found.kind === 'deploy-time' ? found : { kind: 'unset' };
    default:
      if (found.kind === 'absent') return { kind: 'value', value: '' };
      return found;
  }
};

/** Compose interpolation of one value: a reference supplied at deploy time makes the whole value deploy-time. */
export const interpolate = (raw: string, environment?: ContractSettings): Resolved => {
  const lookup = lookupIn(environment);
  let deployTime = false;
  let missing = false;
  const value = raw.replace(REFERENCE, (match, braced: string | undefined, operator: string | undefined, operand: string | undefined, bare: string | undefined) => {
    if (match === '$$') return '$';
    const name = braced ?? bare ?? '';
    const resolved = resolveReference(lookup(name), operator, operand ?? '', environment !== undefined);
    if (resolved.kind === 'deploy-time') deployTime = true;
    if (resolved.kind === 'unset') missing = true;
    return resolved.kind === 'value' ? resolved.value : '';
  });
  if (missing) return { kind: 'unset' };
  return deployTime ? { kind: 'deploy-time' } : { kind: 'value', value };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const scalarText = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

/** Entries of a service's `environment`, list or map form; `undefined` marks a key passed through from the deploy shell. */
const environmentEntries = (environment: unknown): [string, string | undefined][] => {
  if (Array.isArray(environment)) {
    return environment.map((line): [string, string | undefined] => {
      const text = scalarText(line);
      const separator = text.indexOf('=');
      return separator < 0 ? [text, undefined] : [text.slice(0, separator), text.slice(separator + 1)];
    });
  }
  if (isRecord(environment)) {
    return Object.entries(environment).map(([key, value]): [string, string | undefined] => [key, value === null || value === undefined ? undefined : scalarText(value)]);
  }
  return [];
};

const lookupPassThrough = (key: string, environment: ContractSettings | undefined): Resolved => {
  const found = lookupIn(environment)(key);
  return found.kind === 'absent' ? { kind: 'unset' } : found;
};

export const readComposeService = (content: string, file: string, service: string, environment?: ContractSettings): ContractSettings => {
  const document: unknown = yaml.load(content);
  const services = isRecord(document) ? document.services : undefined;
  const definition = isRecord(services) ? services[service] : undefined;
  if (!isRecord(definition)) throw new Error(`${file} has no service "${service}"`);
  if (definition.environment === undefined) throw new Error(`${file} has no environment for service "${service}"`);

  const settings = emptySettings();
  for (const [key, raw] of environmentEntries(definition.environment)) {
    const resolved = raw === undefined ? lookupPassThrough(key, environment) : interpolate(raw, environment);
    if (resolved.kind === 'value') setValue(settings, key, resolved.value);
    else if (resolved.kind === 'deploy-time') setDeployTime(settings, key);
    else unset(settings, key);
  }
  return settings;
};
