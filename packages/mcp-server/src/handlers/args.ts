import { z } from 'zod';
import { FieldSchema, FieldUpdateSchema, FieldValueSchema, RuleDomainSchema } from '@quotentiroler/guido-types/schemas';

export type ToolArgs = Record<string, unknown>;

export const RuleDomainListSchema = z.array(RuleDomainSchema);
export const FieldUpdateListSchema = z.array(FieldUpdateSchema);
export { FieldSchema, FieldValueSchema };

export function optArg<T>(args: ToolArgs, key: string, schema: z.ZodType<T>): T | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid argument "${key}": ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

export function reqArg<T>(args: ToolArgs, key: string, schema: z.ZodType<T>): T {
  const value = optArg(args, key, schema);
  if (value === undefined) throw new Error(`Missing required argument "${key}"`);
  return value;
}

export const optString = (args: ToolArgs, key: string) => optArg(args, key, z.string());
export const reqString = (args: ToolArgs, key: string) => reqArg(args, key, z.string());
export const optNumber = (args: ToolArgs, key: string) => optArg(args, key, z.number());
export const reqNumber = (args: ToolArgs, key: string) => reqArg(args, key, z.number());
export const optBoolean = (args: ToolArgs, key: string) => optArg(args, key, z.boolean());
export const optStrings = (args: ToolArgs, key: string) => optArg(args, key, z.array(z.string()));
export const reqNumbers = (args: ToolArgs, key: string) => reqArg(args, key, z.array(z.number()));
