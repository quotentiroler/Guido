import { existsSync, readFileSync, writeFileSync } from 'fs';
import { isAbsolute, relative } from 'path';
import { parseWranglerConfig, wranglerBindingNames } from './sources/wrangler.js';
import { scanFiles } from './scan.js';
import { docsSections, eolOf, renderDocs, renderEnvExample, scaffoldDocs, templateSections, toLf, withEol } from './generate.js';
import { runProblems, runTarget } from './validate.js';
import type { LoadedContract } from './config.js';
import type { ContractReport } from './report.js';

export { loadContract, parseContractConfig, DEFAULT_CONFIG, type LoadedContract } from './config.js';
export { printReport, githubAnnotation, formatProblem, type ContractProblem, type ContractReport, type ReportOutput } from './report.js';
export { readSource, describeSource } from './sources/index.js';
export { scanText, scanFiles, type ScanResult, type CodeRead } from './scan.js';
export { renderDocs, renderEnvExample, docsSections, scaffoldDocs } from './generate.js';
export type { ContractSettings } from './settings.js';

export const CONTRACT_COMMANDS = ['check', 'generate', 'validate', 'all'] as const;
export type ContractCommand = (typeof CONTRACT_COMMANDS)[number];

export interface ContractRunOptions {
  targets?: readonly string[];
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface GeneratedFile {
  path: string;
  label: string;
  render: () => string;
}

const display = (contract: LoadedContract, path: string): string => {
  const inRoot = relative(contract.root, path);
  return inRoot && !inRoot.startsWith('..') && !isAbsolute(inRoot) ? inRoot.replace(/\\/g, '/') : path;
};

const readIfExists = (path: string): string | undefined => (existsSync(path) ? readFileSync(path, 'utf-8') : undefined);

function generatedFiles(contract: LoadedContract): GeneratedFile[] {
  const { generate } = contract.config;
  const { template, context } = contract;
  const files: GeneratedFile[] = [];
  const docsPath = generate?.docs ? context.path(generate.docs.path) : undefined;
  const currentDocs = (): string => (docsPath ? readIfExists(docsPath) ?? scaffoldDocs(template) : '');

  if (docsPath && generate?.docs) {
    files.push({ path: docsPath, label: generate.docs.path, render: () => renderDocs(currentDocs(), template.fields) });
  }
  const envExample = generate?.envExample;
  if (envExample) {
    const header = envExample.header ?? [
      `# ${template.name} environment variables`,
      `# Generated from ${display(contract, contract.templatePath)}; edit the template, not this file.`,
    ];
    files.push({
      path: context.path(envExample.path),
      label: envExample.path,
      render: () =>
        renderEnvExample(template, {
          header,
          sections: docsPath ? docsSections(renderDocs(currentDocs(), template.fields)) : templateSections(template),
          requiredRuleset: envExample.requiredRuleset,
          wrap: envExample.wrap,
        }),
    });
  }
  return files;
}

function checkGenerated(contract: LoadedContract, report: ContractReport): void {
  for (const file of generatedFiles(contract)) {
    const current = readIfExists(file.path);
    try {
      if (current === undefined) report.problems.push({ scope: 'generate', message: `${file.label} is missing: run guido-contract generate`, file: file.label });
      else if (toLf(current) !== file.render()) report.problems.push({ scope: 'generate', message: `${file.label} is stale: run guido-contract generate`, file: file.label });
      else report.notes.push(`✅ ${file.label} is current`);
    } catch (error) {
      report.problems.push({ scope: 'generate', message: `${file.label}: ${messageOf(error)}`, file: file.label });
    }
  }
}

function checkScan(contract: LoadedContract, report: ContractReport): void {
  const { scan } = contract.config;
  if (!scan) return;
  const ignored = new Set(scan.ignore ?? []);
  for (const path of scan.ignoreBindingsFrom ?? []) {
    wranglerBindingNames(parseWranglerConfig(contract.context.read(path), path)).forEach((name) => ignored.add(name));
  }
  const reads = scanFiles(contract.root, scan.files);
  const declared = new Set(contract.template.fields.map((field) => field.name));
  const templateLabel = display(contract, contract.templatePath);

  const undeclared = [...reads.keys()].filter((name) => !declared.has(name) && !ignored.has(name)).sort();
  for (const name of undeclared) {
    const read = reads.get(name);
    report.problems.push({ scope: 'scan', message: `${name} is read by the code but missing from ${templateLabel}`, file: read?.file, line: read?.line });
  }
  const unread = [...declared].filter((name) => !reads.has(name) && !ignored.has(name)).sort();
  if (unread.length > 0) {
    report.problems.push({ scope: 'scan', message: `in ${templateLabel} but never read by the code: ${unread.join(', ')}`, file: templateLabel });
  }
  if (undeclared.length === 0 && unread.length === 0) {
    report.notes.push(`✅ code reads match ${templateLabel} (${declared.size} fields, ${reads.size} names read)`);
  }
}

function generate(contract: LoadedContract, report: ContractReport): void {
  const files = generatedFiles(contract);
  if (files.length === 0) report.notes.push('nothing to generate: the config has no "generate" section');
  for (const file of files) {
    try {
      const existing = readIfExists(file.path);
      const rendered = file.render();
      if (existing !== undefined && toLf(existing) === rendered) {
        report.notes.push(`✅ ${file.label} is current`);
        continue;
      }
      writeFileSync(file.path, withEol(rendered, existing === undefined ? '\n' : eolOf(existing)));
      report.notes.push(`📝 wrote ${file.label}`);
    } catch (error) {
      report.problems.push({ scope: 'generate', message: `${file.label}: ${messageOf(error)}`, file: file.label });
    }
  }
}

function validate(contract: LoadedContract, report: ContractReport, options: ContractRunOptions): void {
  const all = contract.config.targets ?? [];
  const unknown = (options.targets ?? []).filter((name) => !all.some((target) => target.name === name));
  unknown.forEach((name) =>
    report.problems.push({ scope: 'validate', message: `no target named "${name}". Targets: ${all.map((t) => t.name).join(', ') || '(none)'}` })
  );
  const selected = options.targets?.length ? all.filter((target) => options.targets?.includes(target.name)) : all;
  if (all.length === 0) report.notes.push('nothing to validate: the config has no "targets"');

  for (const target of selected) {
    try {
      for (const run of runTarget(contract.template, target, contract.context)) {
        const deployTime = run.deployTime > 0 ? `, ${run.deployTime} supplied at deploy time` : '';
        report.notes.push(`${run.passed ? '✅' : '❌'} ${run.target}${run.ruleset ? ` vs ${run.ruleset}` : ''}: ${run.source}, ${run.keys} keys${deployTime}`);
        if (!target.strict) run.warnings.forEach((warning) => report.notes.push(`   ⚠️  ${warning.field}: ${warning.message}`));
        report.problems.push(...runProblems(run, target.strict ?? false));
      }
    } catch (error) {
      report.problems.push({ scope: target.name, message: messageOf(error) });
    }
  }
}

export function runContract(contract: LoadedContract, command: ContractCommand, options: ContractRunOptions = {}): ContractReport {
  const report: ContractReport = { problems: [], notes: [] };
  if (command === 'generate') {
    generate(contract, report);
    return report;
  }
  if (command === 'check' || command === 'all') {
    checkGenerated(contract, report);
    try {
      checkScan(contract, report);
    } catch (error) {
      report.problems.push({ scope: 'scan', message: messageOf(error) });
    }
  }
  if (command === 'validate' || command === 'all') validate(contract, report, options);
  return report;
}
