export const HELP_FLAGS: readonly string[] = ['-h', '--help'];

export interface ValueOption<V extends string> {
  key: V;
  names: readonly string[];
  ignoreWithoutValue?: boolean;
}

export interface FlagOption<B extends string> {
  key: B;
  names: readonly string[];
}

export interface ArgvSpec<V extends string, B extends string> {
  values?: readonly ValueOption<V>[];
  flags?: readonly FlagOption<B>[];
}

export interface ParsedArgv<V extends string, B extends string> {
  value(key: V): string | undefined;
  values(key: V): (string | undefined)[];
  flag(key: B): boolean;
  positionals: string[];
  help: boolean;
}

export function wantsHelp(argv: readonly string[]): boolean {
  return argv.some((arg) => HELP_FLAGS.includes(arg));
}

export function parseArgv<V extends string = never, B extends string = never>(
  argv: readonly string[],
  spec: ArgvSpec<V, B>
): ParsedArgv<V, B> {
  const valueOptions = spec.values ?? [];
  const flagOptions = spec.flags ?? [];
  const values = new Map<V, (string | undefined)[]>();
  const flags = new Set<B>();
  const positionals: string[] = [];
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next: string | undefined = argv[i + 1];
    const valueOption = valueOptions.find((option) => option.names.includes(arg));
    const flagOption = flagOptions.find((option) => option.names.includes(arg));

    if (HELP_FLAGS.includes(arg)) {
      help = true;
    } else if (valueOption && (next || !valueOption.ignoreWithoutValue)) {
      values.set(valueOption.key, [...(values.get(valueOption.key) ?? []), next]);
      i++;
    } else if (flagOption) {
      flags.add(flagOption.key);
    } else if (!arg.startsWith('-')) {
      positionals.push(arg);
    }
  }

  return {
    value: (key) => values.get(key)?.at(-1),
    values: (key) => values.get(key) ?? [],
    flag: (key) => flags.has(key),
    positionals,
    help,
  };
}
