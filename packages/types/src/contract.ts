/**
 * Configuration contract: a template plus where its settings are read, documented and supplied.
 * Read by `guido-contract`; every path resolves against `root`, which resolves against the config file.
 */
import { z } from 'zod';
import { FieldValueSchema } from './schemas.js';

export const SCAN_PRESETS = [
  'process-env',
  'env-helper-call',
  'workers-env',
  'import-meta-env',
  'spring-placeholder',
  'java-getenv',
] as const;

export const ScanPresetSchema = z.enum(SCAN_PRESETS);

export const ScanPatternSchema = z.union([
  ScanPresetSchema,
  z.object({
    regex: z.string().describe('Regular expression with exactly one capture group: the variable name.'),
    flags: z.string().optional().describe('Extra regex flags; g is always added.'),
  }),
]);

export const ScanFilesSchema = z.object({
  include: z.array(z.string()).min(1).describe('Globs of files to scan.'),
  exclude: z.array(z.string()).optional().describe('Globs to skip.'),
  patterns: z.array(ScanPatternSchema).min(1).describe('Presets or regexes that find variable reads.'),
});

export const ScanConfigSchema = z.object({
  files: z.array(ScanFilesSchema).min(1),
  ignore: z.array(z.string()).optional().describe('Names read by the code that are not part of the contract (CI-only variables, bindings).'),
  ignoreBindingsFrom: z.array(z.string()).optional().describe('Wrangler configs whose binding names (KV, D1, R2, Durable Objects, services, ...) are ignored.'),
});

export const SecretNamesSchema = z.object({
  names: z.array(z.string()).optional(),
  file: z.string().optional().describe('One name per line, or JSON as printed by `wrangler secret list --format json`.'),
});

const sourceBase = {
  select: z.record(z.string(), z.string()).optional().describe('Keep only these keys, renamed: source key to contract key.'),
  excludePrefixes: z.array(z.string()).optional().describe('Drop keys starting with any of these prefixes.'),
  secrets: SecretNamesSchema.optional().describe('Names supplied at deploy time: present, value unknown.'),
};

export const DotenvSourceSchema = z.object({ type: z.literal('dotenv'), path: z.string(), ...sourceBase });

export const FileSourceSchema = z.object({
  type: z.literal('file'),
  path: z.string(),
  format: z.string().optional().describe('Config format (json, yaml, ini, properties, env, ...); detected from the extension when omitted.'),
  ...sourceBase,
});

export const WranglerSourceSchema = z.object({
  type: z.literal('wrangler'),
  path: z.string().describe('wrangler.toml, wrangler.json or wrangler.jsonc.'),
  env: z.string().optional().describe('Named environment; its vars are not inherited from the top level.'),
  ...sourceBase,
});

export const SpringSourceSchema = z.object({
  type: z.literal('spring'),
  dir: z.string().describe('Directory holding application.properties / application.yml.'),
  name: z.string().optional().describe('Config name, default "application".'),
  profiles: z.array(z.string()).optional().describe('Profiles layered over the base config, in order.'),
  profileVariable: z.union([z.string(), z.literal(false)]).optional().describe('Key that receives the active profiles, default SPRING_PROFILES_ACTIVE; false to omit.'),
  ...sourceBase,
});

export const SecretsSourceSchema = z.object({ type: z.literal('secrets'), ...SecretNamesSchema.shape, excludePrefixes: sourceBase.excludePrefixes });

export const ValuesSourceSchema = z.object({
  type: z.literal('values'),
  values: z.record(z.string(), FieldValueSchema).describe('Literal settings, such as values the platform sets.'),
  ...sourceBase,
});

export interface ComposeSource {
  type: 'compose';
  path: string;
  service: string;
  interpolate?: ContractSource;
  select?: Record<string, string>;
  excludePrefixes?: string[];
  secrets?: z.infer<typeof SecretNamesSchema>;
}

export interface MergeSource {
  type: 'merge';
  sources: ContractSource[];
  select?: Record<string, string>;
  excludePrefixes?: string[];
  secrets?: z.infer<typeof SecretNamesSchema>;
}

export type ContractSource =
  | z.infer<typeof DotenvSourceSchema>
  | z.infer<typeof FileSourceSchema>
  | z.infer<typeof WranglerSourceSchema>
  | z.infer<typeof SpringSourceSchema>
  | z.infer<typeof SecretsSourceSchema>
  | z.infer<typeof ValuesSourceSchema>
  | ComposeSource
  | MergeSource;

export const ComposeSourceSchema: z.ZodType<ComposeSource> = z.object({
  type: z.literal('compose'),
  path: z.string(),
  service: z.string(),
  get interpolate() {
    return ContractSourceSchema.optional().describe('Where ${VAR} references resolve from; without it they are supplied at deploy time unless they carry a default.');
  },
  ...sourceBase,
});

export const MergeSourceSchema: z.ZodType<MergeSource> = z.object({
  type: z.literal('merge'),
  get sources() {
    return z.array(ContractSourceSchema).min(1).describe('Sources layered in order; later keys win.');
  },
  ...sourceBase,
});

export const ContractSourceSchema: z.ZodType<ContractSource> = z.union([
  DotenvSourceSchema,
  FileSourceSchema,
  WranglerSourceSchema,
  SpringSourceSchema,
  SecretsSourceSchema,
  ValuesSourceSchema,
  ComposeSourceSchema,
  MergeSourceSchema,
]);

export const ContractTargetSchema = z
  .object({
    name: z.string(),
    source: ContractSourceSchema,
    ruleset: z.string().optional(),
    tag: z.string().optional().describe('Validate against every ruleset with this tag.'),
    strict: z.boolean().optional().describe('Fail on warnings such as keys the template does not define.'),
  })
  .refine((target) => !(target.ruleset && target.tag), { message: 'Set ruleset or tag, not both' });

export const ContractGenerateSchema = z.object({
  docs: z
    .object({ path: z.string() })
    .optional()
    .describe('Markdown page whose <!-- guido:fields #anchor --> blocks are regenerated from fields linking to that anchor.'),
  envExample: z
    .object({
      path: z.string(),
      header: z.array(z.string()).optional().describe('Lines written before the first section.'),
      requiredRuleset: z.string().optional().describe('Unconditional targets of this ruleset are written uncommented with their example.'),
      wrap: z.number().int().positive().optional().describe('Comment width, default 88.'),
    })
    .optional(),
});

export const ContractConfigSchema = z.object({
  $schema: z.string().optional(),
  root: z.string().optional().describe('Base directory for every other path, relative to this file. Default ".".'),
  template: z.string(),
  scan: ScanConfigSchema.optional(),
  generate: ContractGenerateSchema.optional(),
  targets: z.array(ContractTargetSchema).optional(),
});

export type ScanPreset = z.infer<typeof ScanPresetSchema>;
export type ScanPattern = z.infer<typeof ScanPatternSchema>;
export type ScanFiles = z.infer<typeof ScanFilesSchema>;
export type ScanConfig = z.infer<typeof ScanConfigSchema>;
export type SecretNames = z.infer<typeof SecretNamesSchema>;
export type ContractTarget = z.infer<typeof ContractTargetSchema>;
export type ContractGenerate = z.infer<typeof ContractGenerateSchema>;
export type ContractConfig = z.infer<typeof ContractConfigSchema>;

export const contractConfigJsonSchema = (): unknown => z.toJSONSchema(ContractConfigSchema, { io: 'input' });
