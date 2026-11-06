import type { Field, Template } from '@quotentiroler/guido-types';
import { getToolDef, templateToolHandlers, type ToolArgs } from '@quotentiroler/guido-mcp-server/definitions';
import type { GuidoToolContext } from './guidoTools';

export const SHARED_TOOLS: Record<string, string> = {
  get_template_info: 'get_template_info',
  get_fields: 'list_fields',
  get_field: 'get_field',
  set_field: 'set_field',
  get_rules: 'list_rules',
  get_rule: 'get_rule',
  add_rule: 'add_rule',
  update_rule: 'update_rule',
  delete_rule: 'delete_rule',
  get_rulesets: 'list_rulesets',
  validate_rules: 'validate_rules',
  validate_field: 'validate_field',
  explain_field: 'explain_field',
  fetch_template_docs: 'fetch_template_docs',
  fetch_field_docs: 'fetch_field_docs',
};

const METADATA_KEYS = ['info', 'example', 'range', 'link'] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function snapshot(context: GuidoToolContext): Template {
  return structuredClone({ ...context.template, fields: context.fields, ruleSets: context.ruleSets });
}

function withSelectedRuleSet(mcpName: string, args: ToolArgs, context: GuidoToolContext): ToolArgs {
  const takesRuleSet = getToolDef(mcpName)?.inputs.ruleSetIndex !== undefined;
  return takesRuleSet && args.ruleSetIndex == null ? { ...args, ruleSetIndex: context.selectedRuleSetIndex } : args;
}

function commitFieldThroughHistory(aiName: string, before: Field, after: Field, context: GuidoToolContext): void {
  const { handleFieldChange } = context;
  if (handleFieldChange && (!same(before.value, after.value) || before.checked !== after.checked)) {
    handleFieldChange(after.name, after.value, after.checked ?? true, aiName);
  }
  if (METADATA_KEYS.some(key => before[key] !== after[key])) {
    const patch = Object.fromEntries(METADATA_KEYS.map(key => [key, after[key]]));
    context.setFields(prev => prev.map(f => (f.name === after.name ? { ...f, ...patch } : f)));
  }
}

function commitFields(aiName: string, args: ToolArgs, before: Template, after: Template, context: GuidoToolContext): void {
  const fieldName = aiName === 'set_field' && typeof args.name === 'string' ? args.name : undefined;
  const original = before.fields.find(f => f.name === fieldName);
  const updated = after.fields.find(f => f.name === fieldName);
  if (context.handleFieldChange && original && updated) {
    commitFieldThroughHistory(aiName, original, updated, context);
  } else {
    context.setFields(after.fields);
  }
}

function commit(aiName: string, args: ToolArgs, before: Template, after: Template, context: GuidoToolContext): void {
  if (!same(before.ruleSets, after.ruleSets)) {
    context.setRuleSets(after.ruleSets);
    context.ruleSets = after.ruleSets;
  }
  if (!same(before.fields, after.fields)) {
    commitFields(aiName, args, before, after, context);
    context.fields = after.fields;
  }
}

export function isSharedTool(aiName: string): boolean {
  return aiName in SHARED_TOOLS;
}

export async function runSharedTool(aiName: string, args: ToolArgs, context: GuidoToolContext): Promise<unknown> {
  const mcpName = SHARED_TOOLS[aiName];
  const handler = mcpName ? templateToolHandlers[mcpName] : undefined;
  if (!mcpName || !handler) throw new Error(`Unknown tool: ${aiName}`);

  const before = snapshot(context);
  const working = structuredClone(before);
  const scopedArgs = withSelectedRuleSet(mcpName, args, context);
  const save = () => commit(aiName, scopedArgs, before, working, context);
  const result: unknown = await handler(scopedArgs, working, { filePath: context.template.fileName, save });
  return result;
}
