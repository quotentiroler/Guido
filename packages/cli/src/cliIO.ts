/* eslint-disable no-console */
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { basename, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { CONFIG_FORMATS, detectFormat, formatMeta, parseSettings } from '@quotentiroler/guido-core';
import type { Field, FieldValue, Template } from '@quotentiroler/guido-types';
import { parseTemplate } from '@quotentiroler/guido-types/schemas';

export const SETTINGS_EXTENSIONS = CONFIG_FORMATS.flatMap((format) => formatMeta(format).extensions).join(', ');

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
  return parseTemplate(JSON.parse(readFileSync(absolutePath, 'utf-8')), absolutePath);
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

export function loadSettings(path: string, fields?: readonly Field[]): Record<string, FieldValue> {
  const { content } = readExistingFile(path, 'Settings');
  const format = detectFormat(basename(path));
  if (!format) {
    throw new Error(`Unsupported settings format: ${extname(path).toLowerCase() || basename(path)}. Supported: ${SETTINGS_EXTENSIONS}`);
  }
  return parseSettings(content, format, { fields });
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
