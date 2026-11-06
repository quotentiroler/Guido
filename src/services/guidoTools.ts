import { z } from 'zod';
import type { ToolDefinition, ToolCall, ToolResult } from './llmService';
import type { Field, RuleSet } from '@quotentiroler/guido-types';
import { logger } from '@/utils/logger';
import {
  EXPERT_SYSTEM_PROMPT,
  SIMPLE_SYSTEM_PROMPT,
  getSystemPrompt,
  formatToolList,
  type TemplateContext,
} from './prompts';
import { toolDefinitions as mcpToolDefinitions, buildInputSchema, type ToolDef } from '@quotentiroler/guido-mcp-server/definitions';
import { SHARED_TOOLS, isSharedTool, runSharedTool } from './sharedTools';
import { UI_TOOLS } from './uiTools';

export { EXPERT_SYSTEM_PROMPT, SIMPLE_SYSTEM_PROMPT, getSystemPrompt, formatToolList, type TemplateContext };

const EXPERT_ONLY_TOOLS = new Set([
  'get_fields',
  'get_rules',
  'get_rule',
  'add_rule',
  'update_rule',
  'delete_rule',
  'parse_natural_rule',
  'get_rulesets',
  'validate_rules',
  'explain_field',
]);

function mcpToolToAiTool(mcpTool: ToolDef, aiName: string): ToolDefinition {
  const { filePath: _filePath, ...inputs } = mcpTool.inputs;
  return {
    name: aiName,
    description: mcpTool.description,
    expertOnly: EXPERT_ONLY_TOOLS.has(aiName),
    inputSchema: z.object(buildInputSchema(inputs)),
  };
}

const AI_ONLY_TOOLS: ToolDefinition[] = [
  {
    name: 'search_fields',
    description: 'Search for fields by name, description, or example values. Use this to find relevant fields before modifying them.',
    inputSchema: z.object({
      query: z.string().describe('Search query to find in field names, descriptions, or examples'),
    }),
  },
  {
    name: 'toggle_field',
    description: 'Toggle a field\'s checked/enabled state. Checked fields are included in the output configuration.',
    inputSchema: z.object({
      name: z.string().describe('The exact name of the field to toggle'),
      checked: z.boolean().describe('The new checked state (true = enabled, false = disabled)'),
    }),
  },
  {
    name: 'parse_natural_rule',
    description: 'Parse a natural language description into a Guido rule. Example: "If Database.Type is SQLite, then Database.ConnectionString is required"',
    expertOnly: true,
    inputSchema: z.object({
      text: z.string().describe('Natural language rule description to parse'),
      addToRuleSet: z.boolean().optional().describe('If true, add the parsed rule to the current ruleset (default: false, just returns the parsed rule)'),
    }),
  },
  {
    name: 'get_help',
    description: 'Fetch help documentation for Guido. Use this when users ask about how to use Guido, what features are available, or need guidance on configuration concepts. Returns markdown-formatted help content.',
    inputSchema: z.object({
      mode: z.enum(['expert', 'simple']).optional().describe('Which help mode to fetch. Use "expert" for comprehensive documentation with technical details, or "simple" for a quick-start guide. Default is "expert".'),
    }),
  },
  {
    name: 'search_registries',
    description: 'Search all enabled registries (GitHub, NPM, Simplifier, Built-in) for templates. Returns a list of available packages/templates that can be loaded.',
    inputSchema: z.object({
      query: z.string().describe('Search query to find templates/packages in the registries'),
    }),
  },
  {
    name: 'load_template_from_registry',
    description: 'Load a template from the registry search results. Use search_registries first to find available templates, then use this tool with the exact package name and source.',
    inputSchema: z.object({
      packageName: z.string().describe('The exact name of the package/template to load (from search_registries results)'),
      source: z.enum(['github', 'npm', 'simplifier', 'builtIn', 'custom']).describe('The registry source where the template was found'),
      version: z.string().optional().describe('Optional: specific version to load (defaults to latest)'),
    }),
  },
];

function buildGuidoTools(): ToolDefinition[] {
  const byMcpName = new Map(mcpToolDefinitions.map(tool => [tool.name, tool]));
  const shared = Object.entries(SHARED_TOOLS).flatMap(([aiName, mcpName]) => {
    const mcpTool = byMcpName.get(mcpName);
    return mcpTool ? [mcpToolToAiTool(mcpTool, aiName)] : [];
  });
  return [...shared, ...AI_ONLY_TOOLS];
}

export const GUIDO_TOOLS: ToolDefinition[] = buildGuidoTools();

export function getToolsForMode(isExpertMode: boolean): ToolDefinition[] {
  return isExpertMode ? GUIDO_TOOLS : GUIDO_TOOLS.filter(tool => !tool.expertOnly);
}

export interface RegistrySearchItem {
  name: string;
  description: string;
  source: 'github' | 'npm' | 'simplifier' | 'builtIn' | 'custom';
  registryName?: string;
  downloadUrl?: string;
}

export interface GuidoToolContext {
  template: {
    name: string;
    fileName: string;
    version: string;
    description: string;
    owner: string;
    application?: string;
    docs?: string;
  };
  fields: Field[];
  setFields: React.Dispatch<React.SetStateAction<Field[]>>;
  handleFieldChange?: (name: string, value: Field['value'], checked: boolean, aiTool?: string) => void;
  ruleSets: RuleSet[];
  setRuleSets: React.Dispatch<React.SetStateAction<RuleSet[]>>;
  selectedRuleSetIndex: number;
  searchRegistries?: (query: string) => Promise<RegistrySearchItem[]>;
  loadTemplateFromRegistry?: (packageName: string, source: string, version?: string) => Promise<{ success: boolean; message: string; templateName?: string }>;
}

function runTool(name: string, args: Record<string, unknown>, context: GuidoToolContext): Promise<unknown> {
  if (isSharedTool(name)) return runSharedTool(name, args, context);
  const uiTool = UI_TOOLS[name];
  if (!uiTool) throw new Error(`Unknown tool: ${name}`);
  return uiTool(args, context);
}

export async function executeToolCall(toolCall: ToolCall, context: GuidoToolContext): Promise<ToolResult> {
  const { name, arguments: args, id } = toolCall;
  logger.debug(`[AI Tool] Executing tool: ${name}`, { toolCallId: id, args });
  try {
    const result = await runTool(name, args, context);
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    logger.info(`[AI Tool] Tool ${name} completed successfully`, { toolCallId: id, resultLength: text.length });
    return { toolCallId: id, result: text, isError: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[AI Tool] Tool ${name} failed`, { toolCallId: id, error: errorMessage });
    return { toolCallId: id, result: `Error: ${errorMessage}`, isError: true };
  }
}

export function executeToolCalls(toolCalls: ToolCall[], context: GuidoToolContext): Promise<ToolResult[]> {
  return Promise.all(toolCalls.map(tc => executeToolCall(tc, context)));
}
