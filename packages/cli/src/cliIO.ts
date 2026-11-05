/* eslint-disable no-console */
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { basename, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  CONFIG_FORMATS,
  detectFormat,
  flattenObject,
  formatMeta,
  parseKeyValueFormat,
  toFieldValues,
  type ConfigFormat,
} from '@quotentiroler/guido-core';
import type { FieldValue, Template } from '@quotentiroler/guido-types';
import * as yaml from 'js-yaml';

type Settings = Record<string, FieldValue>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const flattenDocument = (document: unknown, path: string): Settings => {
  if (!isRecord(document)) {
    throw new Error(`Settings file does not contain an object: ${path}`);
  }
  return toFieldValues(flattenObject(document));
};

const SETTINGS_PARSERS: Partial<Record<ConfigFormat, (content: string, path: string) => Settings>> = {
  json: (content, path) => flattenDocument(JSON.parse(content), path),
  yaml: (content, path) => flattenDocument(yaml.load(content), path),
  properties: (content) => toFieldValues(parseKeyValueFormat(content)),
  env: (content) => toFieldValues(parseKeyValueFormat(content)),
  txt: (content) => toFieldValues(parseKeyValueFormat(content)),
};

const SETTINGS_EXTENSIONS = CONFIG_FORMATS.filter((format) => SETTINGS_PARSERS[format])
  .flatMap((format) => formatMeta(format).extensions)
  .join(', ');

export function isEntryPoint(moduleUrl: string): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return realpathSync.native(invoked) === realpathSync.native(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

export function exitWithUsage(usage: string, help: boolean, failureCode: number): never {
  console.log(usage);
  process.exit(help ? 0 : failureCode);
}

export function readTemplateFile(absolutePath: string): Template {
  return JSON.parse(readFileSync(absolutePath, 'utf-8')) as Template;
}

function readExistingFile(path: string, label: string): { absolutePath: string; content: string } {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`${label} file not found: ${absolutePath}`);
  }
  return { absolutePath, content: readFileSync(absolutePath, 'utf-8') };
}

export function loadTemplate(path: string): Template {
  const { absolutePath } = readExistingFile(path, 'Template');
  return readTemplateFile(absolutePath);
}

export function loadSettings(path: string): Settings {
  const { absolutePath, content } = readExistingFile(path, 'Settings');
  const format = detectFormat(basename(path));
  const parse = format && SETTINGS_PARSERS[format];
  if (!parse) {
    throw new Error(`Unsupported settings format: ${extname(path).toLowerCase()}. Supported: ${SETTINGS_EXTENSIONS}`);
  }
  return parse(content, absolutePath);
}

export function exitWithFileError(error: unknown, path: string, invalidJsonLabel = 'Invalid JSON'): never {
  if (!(error instanceof Error)) {
    console.error(`\n❌ Unknown error occurred\n`);
  } else if (error.message.includes('ENOENT')) {
    console.error(`\n❌ Error: File not found: ${path}\n`);
  } else if (error.message.includes('JSON')) {
    console.error(`\n❌ Error: ${invalidJsonLabel}\n${error.message}\n`);
  } else {
    console.error(`\n❌ Error: ${error.message}\n`);
  }
  process.exit(1);
}

export interface ConversionOutput {
  output: string;
  warnings: readonly string[];
  stdout: boolean;
  outputPath: string;
  summary: readonly string[];
}

export function emitConversion({ output, warnings, stdout, outputPath, summary }: ConversionOutput): never {
  if (warnings.length > 0) {
    console.error(`\n⚠️  Warnings (${warnings.length}):`);
    warnings.forEach((warning, i) => console.error(`   ${i + 1}. ${warning}`));
  }
  if (stdout) {
    console.log(output);
  } else {
    writeFileSync(outputPath, output, 'utf-8');
    console.error(`\n✅ Generated: ${outputPath}`);
    summary.forEach((line) => console.error(line));
  }
  console.error('');
  process.exit(0);
}
