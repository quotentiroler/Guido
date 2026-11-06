#!/usr/bin/env node
/* eslint-disable no-console */
import { contractConfigJsonSchema } from '@quotentiroler/guido-types/contract';
import { parseArgv, wantsHelp } from './cliArgs.js';
import { exitWithUsage, isEntryPoint } from './cliIO.js';
import { CONTRACT_COMMANDS, DEFAULT_CONFIG, loadContract, printReport, runContract, type ContractCommand } from './contract/index.js';

const USAGE = `
Usage: guido-contract <check|generate|validate|all|schema> [options]

Keeps a Guido template, the code that reads its settings, the docs and env
example generated from it, and every environment's settings in agreement.

Commands:
  check               Generated files are current; code reads match the template
  generate            Write the generated docs tables and env example
  validate            Validate every target's settings against its ruleset
  all                 check, then validate
  schema              Print the JSON Schema of the config file

Options:
  --config <path>     Contract config (default: ${DEFAULT_CONFIG})
  --target <name>     Validate only this target (repeatable)
  -h, --help          Show this help message

Exit Codes:
  0                   Contract holds
  1                   Problems found
  2                   Usage or config error

When GITHUB_ACTIONS is set, problems are printed as ::error:: annotations.
`;

const isCommand = (value: string | undefined): value is ContractCommand => CONTRACT_COMMANDS.some((command) => command === value);

export interface ContractArgs {
  command: ContractCommand | 'schema';
  configPath: string;
  targets: string[];
}

export function parseContractArgs(args: readonly string[]): ContractArgs | null {
  if (args.length === 0 || wantsHelp(args)) return null;
  const parsed = parseArgv(args, {
    values: [
      { key: 'config', names: ['--config', '-c'], ignoreWithoutValue: true },
      { key: 'target', names: ['--target', '-t'], ignoreWithoutValue: true },
    ],
  });
  const [command] = parsed.positionals;
  if (command !== 'schema' && !isCommand(command)) {
    console.error(`Error: unknown command "${command ?? ''}"`);
    return null;
  }
  return {
    command,
    configPath: parsed.value('config') ?? DEFAULT_CONFIG,
    targets: parsed.values('target').filter((target): target is string => target !== undefined),
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const options = parseContractArgs(args);
  if (!options) exitWithUsage(USAGE, wantsHelp(args), 2);

  if (options.command === 'schema') {
    console.log(JSON.stringify(contractConfigJsonSchema(), null, 2));
    process.exit(0);
  }

  try {
    const contract = loadContract(options.configPath);
    console.error(`📋 ${contract.template.name}: ${contract.template.fields.length} fields (${options.configPath})`);
    const report = runContract(contract, options.command, { targets: options.targets });
    const github = Boolean(process.env.GITHUB_ACTIONS);
    printReport(report, { github, note: (line) => console.error(line), problem: (line) => (github ? console.log(line) : console.error(line)) });
    process.exit(report.problems.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}

if (isEntryPoint(import.meta.url)) main();
