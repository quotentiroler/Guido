import { dirname, isAbsolute, resolve } from 'path';
import { readFileSync } from 'fs';
import { parse as parseJsonc, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { ContractConfigSchema } from '@quotentiroler/guido-types/contract';
import type { ContractConfig, Template } from '@quotentiroler/guido-types';
import { loadTemplate } from '../cliIO.js';
import { createSourceContext, type SourceContext } from './settings.js';

export const DEFAULT_CONFIG = 'guido.contract.json';

export interface LoadedContract {
  config: ContractConfig;
  configPath: string;
  root: string;
  templatePath: string;
  template: Template;
  context: SourceContext;
}

export function parseContractConfig(content: string, label: string): ContractConfig {
  const errors: ParseError[] = [];
  const raw: unknown = parseJsonc(content, errors, { allowTrailingComma: true });
  if (errors.length > 0) throw new Error(`${label}: ${printParseErrorCode(errors[0].error)} at offset ${errors[0].offset}`);
  const parsed = ContractConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new Error(`${label} is not a valid contract config:\n  ${details.join('\n  ')}`);
  }
  return parsed.data;
}

export function loadContract(configPath: string): LoadedContract {
  const absoluteConfig = resolve(configPath);
  const config = parseContractConfig(readFileSync(absoluteConfig, 'utf-8'), configPath);
  const root = resolve(dirname(absoluteConfig), config.root ?? '.');
  const templatePath = isAbsolute(config.template) ? config.template : resolve(root, config.template);
  return { config, configPath: absoluteConfig, root, templatePath, template: loadTemplate(templatePath), context: createSourceContext(root) };
}
