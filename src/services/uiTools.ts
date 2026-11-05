import { z } from 'zod';
import { parseNaturalLanguageRule, translateRule } from '@quotentiroler/guido-core';
import { optArg, optBoolean, reqArg, reqString, optString, type ToolArgs } from '@quotentiroler/guido-mcp-server/definitions';
import type { GuidoToolContext } from './guidoTools';
import { runSharedTool } from './sharedTools';

type UiTool = (args: ToolArgs, context: GuidoToolContext) => Promise<unknown>;

const REGISTRY_SOURCES = ['github', 'npm', 'simplifier', 'builtIn', 'custom'] as const;

function findField(context: GuidoToolContext, name: string) {
  const field = context.fields.find(f => f.name === name);
  if (!field) throw new Error(`Field not found: "${name}". Use get_fields or search_fields to find valid field names.`);
  return field;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

export const UI_TOOLS: Record<string, UiTool> = {
  search_fields: (args, context) => {
    const query = reqString(args, 'query').toLowerCase();
    const matches = context.fields.filter(f =>
      f.name.toLowerCase().includes(query) || f.info.toLowerCase().includes(query) || f.example.toLowerCase().includes(query)
    );
    return Promise.resolve({
      message: matches.length ? `Found ${matches.length} field(s) matching "${query}"` : `No fields found matching "${query}"`,
      results: matches.map(f => ({ name: f.name, info: f.info, value: f.value, checked: f.checked ?? false })),
    });
  },

  toggle_field: (args, context) => {
    const name = reqString(args, 'name');
    const checked = reqArg(args, 'checked', z.boolean());
    const field = findField(context, name);
    if (context.handleFieldChange) {
      context.handleFieldChange(name, field.value, checked, 'toggle_field');
    } else {
      context.setFields(prev => prev.map(f => (f.name === name ? { ...f, checked } : f)));
    }
    return Promise.resolve({ success: true, message: `${checked ? 'Enabled' : 'Disabled'} field "${name}"` });
  },

  parse_natural_rule: async (args, context) => {
    const parsedRule = parseNaturalLanguageRule(reqString(args, 'text'), context.fields.map(f => f.name));
    if (!parsedRule) {
      return {
        success: false,
        error: 'Could not parse the natural language rule. Try formats like:\n' +
          '- "If FieldA is set, then FieldB is required"\n' +
          '- "When Database.Type is SQLite, Database.ConnectionString must be set"\n' +
          '- "If Logging.Enabled, then Logging.Level is required to be set to Debug"',
      };
    }
    const humanReadable = translateRule(parsedRule);
    if (!optBoolean(args, 'addToRuleSet')) return { success: true, parsedRule, humanReadable, addedToRuleSet: false };
    const added = await runSharedTool('add_rule', { ...parsedRule }, context);
    return { success: true, parsedRule, humanReadable, addedToRuleSet: true, added };
  },

  get_help: async (args) => {
    const mode = optArg(args, 'mode', z.enum(['expert', 'simple'])) ?? 'expert';
    const url = `${window.location.origin}${import.meta.env.BASE_URL}${mode === 'simple' ? 'HELP.simple.md' : 'HELP.md'}`;
    return { mode, content: await fetchText(url), source: url };
  },

  search_registries: async (args, context) => {
    if (!context.searchRegistries) throw new Error('Registry search is not available in this view.');
    const query = reqString(args, 'query');
    const results = await context.searchRegistries(query);
    return {
      message: `Found ${results.length} result(s) for "${query}"`,
      results: results.map(({ name, description, source, registryName }) => ({ name, description, source, registryName })),
    };
  },

  load_template_from_registry: async (args, context) => {
    if (!context.loadTemplateFromRegistry) throw new Error('Template loading is not available in this view.');
    const source = reqArg(args, 'source', z.enum(REGISTRY_SOURCES));
    const result = await context.loadTemplateFromRegistry(reqString(args, 'packageName'), source, optString(args, 'version'));
    if (!result.success) throw new Error(result.message);
    return result;
  },
};
