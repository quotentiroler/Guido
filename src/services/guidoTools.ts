/**
 * Guido AI Tools - Tool definitions and executor for LLM-powered configuration
 * 
 * These tools allow an LLM to interact with the Guido template editor:
 * - Read and modify field values
 * - Add and manage rules
 * - Query template metadata
 * 
 * The LLM returns tool calls, and this module executes them against React state.
 * 
 * Tool definitions are shared with the MCP server where possible, with AI-specific
 * adaptations (removing filePath params, adding AI-only tools).
 */

import { z } from 'zod';
import type { ToolDefinition, ToolCall, ToolResult } from './llmService';
import type { Field, Rule, RuleSet, RuleDomain } from '@guido/types';
import { RuleState } from '@guido/types';
import { translateRule, parseNaturalLanguageRule } from '@guido/core';
import { logger } from '@/utils/logger';
import {
  EXPERT_SYSTEM_PROMPT,
  SIMPLE_SYSTEM_PROMPT,
  getSystemPrompt,
  formatToolList,
  type TemplateContext,
} from './prompts';

// Import shared tool definitions from MCP server
import { 
  toolDefinitions as mcpToolDefinitions, 
  buildInputSchema,
  type ToolDef,
} from '@guido/mcp-server/definitions';

// Re-export prompts for external consumers
export { EXPERT_SYSTEM_PROMPT, SIMPLE_SYSTEM_PROMPT, getSystemPrompt, formatToolList, type TemplateContext };

// ============================================================================
// Tool Filtering
// ============================================================================

/** Tools that are only available in expert mode */
const EXPERT_ONLY_TOOLS = new Set([
  'get_fields',
  'list_fields',
  'get_rules',
  'list_rules',
  'add_rule',
  'delete_rule',
  'update_rule',
  'translate_rule',
  'translate_all_rules',
  'parse_natural_rule',
  'get_rulesets',
  'list_rulesets',
  'add_ruleset',
  'update_ruleset',
  'delete_ruleset',
  'validate_rules',
  'merge_rules',
]);

/** MCP tools to include in AI (by name) - we rename some for compatibility */
const MCP_TOOL_MAPPING: Record<string, string> = {
  'get_template_info': 'get_template_info',
  'list_fields': 'get_fields',      // Rename for AI compatibility
  'get_field': 'get_field',
  'set_field': 'set_field',
  'list_rules': 'get_rules',        // Rename for AI compatibility  
  'add_rule': 'add_rule',
  'delete_rule': 'delete_rule',
  'list_rulesets': 'get_rulesets',  // Rename for AI compatibility
  'fetch_template_docs': 'fetch_template_docs',
  'fetch_field_docs': 'fetch_field_docs',
};

/** Tools that are MCP-only (file system operations not applicable to UI) */
const MCP_ONLY_TOOLS = new Set([
  'create_template',
  'set_template',
  'merge_templates',
  'set_fields',
  'add_field',
  'delete_field',
  'update_rule',
  'add_ruleset',
  'update_ruleset', 
  'delete_ruleset',
  'merge_rules',
  'validate_rules',
  'validate_fields',
  'validate_field',
  'validate_template',
  'validate_settings',
]);

/**
 * Convert an MCP tool definition to AI tool format
 * - Removes filePath parameter (UI doesn't need it)
 * - Builds Zod schema for AI SDK
 */
function mcpToolToAiTool(mcpTool: ToolDef, aiName: string): ToolDefinition {
  // Remove filePath from inputs since AI operates on current template in state
  const inputs = { ...mcpTool.inputs };
  delete inputs.filePath;
  
  // Build Zod schema
  const zodSchema = z.object(buildInputSchema(inputs));
  
  return {
    name: aiName,
    description: mcpTool.description,
    expertOnly: EXPERT_ONLY_TOOLS.has(aiName),
    inputSchema: zodSchema,
  };
}

/**
 * AI-only tools that don't exist in MCP
 */
const AI_ONLY_TOOLS: ToolDefinition[] = [
  // Search/toggle are UI-specific
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
  
  // Rule translation tools (AI-specific, not in MCP)
  {
    name: 'translate_rule',
    description: 'Convert a rule (by index) to a human-readable description. Useful for understanding what a rule does.',
    expertOnly: true,
    inputSchema: z.object({
      ruleIndex: z.number().describe('The 0-based index of the rule to translate'),
      ruleSetIndex: z.number().optional().describe('Index of the ruleset (default: current selected ruleset)'),
    }),
  },
  {
    name: 'translate_all_rules',
    description: 'Get human-readable descriptions for all rules in the template. Useful for understanding the full rule set.',
    expertOnly: true,
    inputSchema: z.object({
      ruleSetIndex: z.number().optional().describe('Index of the ruleset (default: current selected ruleset)'),
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
  
  // Help & documentation
  {
    name: 'get_help',
    description: 'Fetch help documentation for Guido. Use this when users ask about how to use Guido, what features are available, or need guidance on configuration concepts. Returns markdown-formatted help content.',
    inputSchema: z.object({
      mode: z.enum(['expert', 'simple']).optional().describe('Which help mode to fetch. Use "expert" for comprehensive documentation with technical details, or "simple" for a quick-start guide. Default is "expert".'),
    }),
  },
  
  // Registry tools (browser-only, use fetch API)
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

/**
 * Build the complete GUIDO_TOOLS array from MCP definitions + AI-only tools
 */
function buildGuidoTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  
  // Add tools from MCP definitions (filtered and renamed)
  for (const mcpTool of mcpToolDefinitions) {
    const aiName = MCP_TOOL_MAPPING[mcpTool.name];
    if (aiName && !MCP_ONLY_TOOLS.has(mcpTool.name)) {
      tools.push(mcpToolToAiTool(mcpTool, aiName));
    }
  }
  
  // Add AI-only tools
  tools.push(...AI_ONLY_TOOLS);
  
  return tools;
}

/**
 * All available Guido tools that the LLM can call
 */
export const GUIDO_TOOLS: ToolDefinition[] = buildGuidoTools();

/**
 * Get tools available for the current mode
 * In simple mode, expert-only tools are filtered out
 */
export function getToolsForMode(isExpertMode: boolean): ToolDefinition[] {
  if (isExpertMode) {
    return GUIDO_TOOLS;
  }
  return GUIDO_TOOLS.filter(tool => !tool.expertOnly);
}

// ============================================================================
// Tool Context - What the executor needs access to
// ============================================================================

/**
 * Search result item from registry search
 */
export interface RegistrySearchItem {
  name: string;
  description: string;
  source: 'github' | 'npm' | 'simplifier' | 'builtIn' | 'custom';
  registryName?: string;
  downloadUrl?: string;
}

export interface GuidoToolContext {
  // Template data
  template: {
    name: string;
    fileName: string;
    version: string;
    description: string;
    owner: string;
    application?: string;
    docs?: string;
  };
  
  // Field state and setters
  fields: Field[];
  setFields: React.Dispatch<React.SetStateAction<Field[]>>;
  
  // Field change handler that goes through history tracking
  handleFieldChange?: (name: string, value: Field['value'], checked: boolean, aiTool?: string) => void;
  
  // Rule state and setters
  ruleSets: RuleSet[];
  setRuleSets: React.Dispatch<React.SetStateAction<RuleSet[]>>;
  selectedRuleSetIndex: number;
  
  // Registry functions (optional - only available when registry hook is provided)
  searchRegistries?: (query: string) => Promise<RegistrySearchItem[]>;
  loadTemplateFromRegistry?: (packageName: string, source: string, version?: string) => Promise<{ success: boolean; message: string; templateName?: string }>;
}

// ============================================================================
// Tool Executor - Runs tools and returns results
// ============================================================================

/**
 * Marker interface for async fetch results
 */
interface AsyncFetchResult {
  _asyncFetch: true;
  url: string;
  mode: string;
}

/**
 * Marker interface for async registry search
 */
interface AsyncRegistrySearchResult {
  _asyncRegistrySearch: true;
  query: string;
}

/**
 * Marker interface for async template load
 */
interface AsyncTemplateLoadResult {
  _asyncTemplateLoad: true;
  packageName: string;
  source: string;
  version?: string;
}

/**
 * Check if a result is an async fetch marker
 */
function isAsyncFetchResult(result: unknown): result is AsyncFetchResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_asyncFetch' in result &&
    (result as AsyncFetchResult)._asyncFetch === true
  );
}

/**
 * Check if a result is an async registry search marker
 */
function isAsyncRegistrySearchResult(result: unknown): result is AsyncRegistrySearchResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_asyncRegistrySearch' in result &&
    (result as AsyncRegistrySearchResult)._asyncRegistrySearch === true
  );
}

/**
 * Check if a result is an async template load marker
 */
function isAsyncTemplateLoadResult(result: unknown): result is AsyncTemplateLoadResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_asyncTemplateLoad' in result &&
    (result as AsyncTemplateLoadResult)._asyncTemplateLoad === true
  );
}

/**
 * Execute a single tool call and return the result (async for fetch operations)
 */
export async function executeToolCall(
  toolCall: ToolCall,
  context: GuidoToolContext
): Promise<ToolResult> {
  const { name, arguments: args, id } = toolCall;
  
  logger.debug(`[AI Tool] Executing tool: ${name}`, { toolCallId: id, args });
  
  try {
    const result = executeToolInternal(name, args, context);
    
    // Handle async fetch operations (like get_help)
    if (isAsyncFetchResult(result)) {
      logger.debug(`[AI Tool] Fetching from URL: ${result.url}`);
      try {
        const response = await fetch(result.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch help: ${response.status} ${response.statusText}`);
        }
        const content = await response.text();
        
        logger.info(`[AI Tool] Tool ${name} fetched successfully`, {
          toolCallId: id,
          url: result.url,
          contentLength: content.length,
        });
        
        return {
          toolCallId: id,
          result: JSON.stringify({
            mode: result.mode,
            content: content,
            source: result.url,
          }, null, 2),
          isError: false,
        };
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        
        logger.error(`[AI Tool] Tool ${name} fetch failed`, {
          toolCallId: id,
          url: result.url,
          error: errorMessage,
        });
        
        return {
          toolCallId: id,
          result: `Error fetching help documentation: ${errorMessage}`,
          isError: true,
        };
      }
    }
    
    // Handle async registry search operations
    if (isAsyncRegistrySearchResult(result)) {
      logger.debug(`[AI Tool] Searching registries for: ${result.query}`);
      try {
        if (!context.searchRegistries) {
          throw new Error('Registry search function not provided');
        }
        const searchResults = await context.searchRegistries(result.query);
        
        logger.info(`[AI Tool] Registry search completed`, {
          toolCallId: id,
          query: result.query,
          resultCount: searchResults.length,
        });
        
        return {
          toolCallId: id,
          result: JSON.stringify({
            message: `Found ${searchResults.length} result(s) for "${result.query}"`,
            results: searchResults.map(item => ({
              name: item.name,
              description: item.description,
              source: item.source,
              registryName: item.registryName,
            })),
          }, null, 2),
          isError: false,
        };
      } catch (searchError) {
        const errorMessage = searchError instanceof Error ? searchError.message : String(searchError);
        
        logger.error(`[AI Tool] Registry search failed`, {
          toolCallId: id,
          query: result.query,
          error: errorMessage,
        });
        
        return {
          toolCallId: id,
          result: `Error searching registries: ${errorMessage}`,
          isError: true,
        };
      }
    }
    
    // Handle async template load operations
    if (isAsyncTemplateLoadResult(result)) {
      logger.debug(`[AI Tool] Loading template: ${result.packageName} from ${result.source}`);
      try {
        if (!context.loadTemplateFromRegistry) {
          throw new Error('Template loading function not provided');
        }
        const loadResult = await context.loadTemplateFromRegistry(
          result.packageName,
          result.source,
          result.version
        );
        
        logger.info(`[AI Tool] Template load completed`, {
          toolCallId: id,
          packageName: result.packageName,
          source: result.source,
          success: loadResult.success,
        });
        
        return {
          toolCallId: id,
          result: JSON.stringify(loadResult, null, 2),
          isError: !loadResult.success,
        };
      } catch (loadError) {
        const errorMessage = loadError instanceof Error ? loadError.message : String(loadError);
        
        logger.error(`[AI Tool] Template load failed`, {
          toolCallId: id,
          packageName: result.packageName,
          source: result.source,
          error: errorMessage,
        });
        
        return {
          toolCallId: id,
          result: `Error loading template: ${errorMessage}`,
          isError: true,
        };
      }
    }
    
    const toolResult = {
      toolCallId: id,
      result: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      isError: false,
    };
    
    logger.info(`[AI Tool] Tool ${name} completed successfully`, {
      toolCallId: id,
      resultLength: toolResult.result.length,
    });
    
    return toolResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(`[AI Tool] Tool ${name} failed`, {
      toolCallId: id,
      error: errorMessage,
    });
    
    return {
      toolCallId: id,
      result: `Error: ${errorMessage}`,
      isError: true,
    };
  }
}

/**
 * Execute multiple tool calls and return all results
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  context: GuidoToolContext
): Promise<ToolResult[]> {
  return Promise.all(toolCalls.map(tc => executeToolCall(tc, context)));
}

/**
 * Internal tool execution logic
 */
function executeToolInternal(
  toolName: string,
  args: Record<string, unknown>,
  context: GuidoToolContext
): unknown {
  switch (toolName) {
    // -----------------------------------------------------------------------
    // Field Tools
    // -----------------------------------------------------------------------
    case 'get_fields': {
      let result = context.fields;
      
      // Apply filter if provided
      if (args.filter && typeof args.filter === 'string') {
        const filter = args.filter.toLowerCase();
        result = result.filter(f => f.name.toLowerCase().includes(filter));
      }
      
      // Filter to checked only if requested
      if (args.checkedOnly === true) {
        result = result.filter(f => f.checked === true);
      }
      
      // Return summary format
      return result.map(f => ({
        name: f.name,
        value: f.value,
        info: f.info,
        checked: f.checked ?? false,
        range: f.range,
      }));
    }
    
    case 'get_field': {
      const name = args.name as string;
      const field = context.fields.find(f => f.name === name);
      
      if (!field) {
        throw new Error(`Field not found: "${name}". Use get_fields or search_fields to find valid field names.`);
      }
      
      return {
        name: field.name,
        value: field.value,
        info: field.info,
        example: field.example,
        range: field.range,
        link: field.link,
        checked: field.checked ?? false,
      };
    }
    
    case 'set_field': {
      const name = args.name as string;
      const valueStr = args.value as string;
      
      const fieldIndex = context.fields.findIndex(f => f.name === name);
      if (fieldIndex === -1) {
        throw new Error(`Field not found: "${name}". Use get_fields or search_fields to find valid field names.`);
      }
      
      const field = context.fields[fieldIndex];
      
      // Parse value - try JSON for arrays, otherwise use as string
      let parsedValue: Field['value'];
      try {
        const parsed = JSON.parse(valueStr);
        if (Array.isArray(parsed)) {
          parsedValue = parsed as string[] | number[];
        } else if (typeof parsed === 'boolean' || typeof parsed === 'number') {
          parsedValue = parsed;
        } else {
          parsedValue = valueStr;
        }
      } catch {
        // Not JSON, use as string
        parsedValue = valueStr;
      }
      
      // Update the field - use history-tracked handler if available
      if (context.handleFieldChange) {
        context.handleFieldChange(name, parsedValue, field.checked ?? true, 'set_field');
      } else {
        // Fallback to direct state update (no history tracking)
        context.setFields(prev => prev.map((f, i) => 
          i === fieldIndex ? { ...f, value: parsedValue } : f
        ));
      }
      
      return {
        success: true,
        message: `Set "${name}" to: ${JSON.stringify(parsedValue)}`,
        previousValue: field.value,
        newValue: parsedValue,
      };
    }
    
    case 'toggle_field': {
      const name = args.name as string;
      const checked = args.checked as boolean;
      
      const fieldIndex = context.fields.findIndex(f => f.name === name);
      if (fieldIndex === -1) {
        throw new Error(`Field not found: "${name}"`);
      }
      
      const field = context.fields[fieldIndex];
      
      // Update the field - use history-tracked handler if available
      if (context.handleFieldChange) {
        context.handleFieldChange(name, field.value, checked, 'toggle_field');
      } else {
        // Fallback to direct state update (no history tracking)
        context.setFields(prev => prev.map((f, i) => 
          i === fieldIndex ? { ...f, checked } : f
        ));
      }
      
      return {
        success: true,
        message: `${checked ? 'Enabled' : 'Disabled'} field "${name}"`,
      };
    }
    
    case 'search_fields': {
      const query = (args.query as string).toLowerCase();
      
      const matches = context.fields.filter(f => 
        f.name.toLowerCase().includes(query) ||
        f.info.toLowerCase().includes(query) ||
        f.example.toLowerCase().includes(query)
      );
      
      if (matches.length === 0) {
        return { message: `No fields found matching "${args.query}"`, results: [] };
      }
      
      return {
        message: `Found ${matches.length} field(s) matching "${args.query}"`,
        results: matches.map(f => ({
          name: f.name,
          info: f.info,
          value: f.value,
          checked: f.checked ?? false,
        })),
      };
    }
    
    // -----------------------------------------------------------------------
    // Rule Tools
    // -----------------------------------------------------------------------
    case 'get_rules': {
      const ruleSetIndex = (args.ruleSetIndex as number) ?? context.selectedRuleSetIndex;
      const ruleSet = context.ruleSets[ruleSetIndex];
      
      if (!ruleSet) {
        throw new Error(`RuleSet at index ${ruleSetIndex} not found. Use get_rulesets to see available rulesets.`);
      }
      
      return {
        ruleSetName: ruleSet.name,
        ruleSetDescription: ruleSet.description,
        rules: ruleSet.rules.map((r, i) => ({
          index: i,
          description: r.description,
          conditions: r.conditions,
          targets: r.targets,
        })),
      };
    }
    
    case 'add_rule': {
      const ruleSetIndex = (args.ruleSetIndex as number) ?? context.selectedRuleSetIndex;
      const description = args.description as string;
      const conditionsRaw = args.conditions as Array<Record<string, unknown>> | undefined;
      const targetsRaw = args.targets as Array<Record<string, unknown>>;
      
      // Validate ruleset exists
      if (!context.ruleSets[ruleSetIndex]) {
        throw new Error(`RuleSet at index ${ruleSetIndex} not found.`);
      }
      
      // Parse conditions
      const conditions: RuleDomain[] | undefined = conditionsRaw?.map(c => ({
        name: c.name as string,
        state: (c.state as string) as RuleState,
        value: c.value as string | undefined,
        not: c.not as boolean | undefined,
      }));
      
      // Parse targets
      const targets: RuleDomain[] = targetsRaw.map(t => ({
        name: t.name as string,
        state: (t.state as string) as RuleState,
        value: t.value as string | undefined,
      }));
      
      // Create new rule
      const newRule: Rule = {
        description,
        conditions,
        targets,
      };
      
      // Add to ruleset
      context.setRuleSets(prev => prev.map((rs, i) => 
        i === ruleSetIndex
          ? { ...rs, rules: [...rs.rules, newRule] }
          : rs
      ));
      
      return {
        success: true,
        message: `Added rule: "${description}"`,
        ruleIndex: context.ruleSets[ruleSetIndex].rules.length,
      };
    }
    
    case 'delete_rule': {
      const ruleSetIndex = (args.ruleSetIndex as number) ?? context.selectedRuleSetIndex;
      const ruleIndex = args.ruleIndex as number;
      
      const ruleSet = context.ruleSets[ruleSetIndex];
      if (!ruleSet) {
        throw new Error(`RuleSet at index ${ruleSetIndex} not found.`);
      }
      
      if (ruleIndex < 0 || ruleIndex >= ruleSet.rules.length) {
        throw new Error(`Rule index ${ruleIndex} is out of bounds. RuleSet has ${ruleSet.rules.length} rules.`);
      }
      
      const deletedRule = ruleSet.rules[ruleIndex];
      
      context.setRuleSets(prev => prev.map((rs, i) => 
        i === ruleSetIndex
          ? { ...rs, rules: rs.rules.filter((_, j) => j !== ruleIndex) }
          : rs
      ));
      
      return {
        success: true,
        message: `Deleted rule at index ${ruleIndex}: "${deletedRule.description || 'No description'}"`,
      };
    }
    
    case 'translate_rule': {
      const ruleSetIndex = (args.ruleSetIndex as number) ?? context.selectedRuleSetIndex;
      const ruleIndex = args.ruleIndex as number;
      
      const ruleSet = context.ruleSets[ruleSetIndex];
      if (!ruleSet) {
        throw new Error(`RuleSet at index ${ruleSetIndex} not found.`);
      }
      
      if (ruleIndex < 0 || ruleIndex >= ruleSet.rules.length) {
        throw new Error(`Rule index ${ruleIndex} is out of bounds. RuleSet has ${ruleSet.rules.length} rules.`);
      }
      
      const rule = ruleSet.rules[ruleIndex];
      const humanReadable = translateRule(rule);
      
      return {
        index: ruleIndex,
        humanReadable,
        description: rule.description,
        rule,
      };
    }
    
    case 'translate_all_rules': {
      const ruleSetIndex = (args.ruleSetIndex as number) ?? context.selectedRuleSetIndex;
      
      const ruleSet = context.ruleSets[ruleSetIndex];
      if (!ruleSet) {
        throw new Error(`RuleSet at index ${ruleSetIndex} not found.`);
      }
      
      return {
        ruleSetName: ruleSet.name,
        ruleCount: ruleSet.rules.length,
        translations: ruleSet.rules.map((rule, index) => ({
          index,
          description: rule.description,
          humanReadable: translateRule(rule),
        })),
      };
    }
    
    case 'parse_natural_rule': {
      const text = args.text as string;
      const addToRuleSet = args.addToRuleSet as boolean ?? false;
      
      // Get field names for context-aware parsing
      const fieldNames = context.fields.map(f => f.name);
      
      const parsedRule = parseNaturalLanguageRule(text, fieldNames);
      
      if (!parsedRule) {
        return {
          success: false,
          error: 'Could not parse the natural language rule. Try formats like:\n' +
            '- "If FieldA is set, then FieldB is required"\n' +
            '- "When Database.Type is SQLite, Database.ConnectionString must be set"\n' +
            '- "If Logging.Enabled, then Logging.Level is required to be set to Debug"',
        };
      }
      
      // Translate back to human readable to verify parsing
      const humanReadable = translateRule(parsedRule);
      
      // Optionally add to the current ruleset
      if (addToRuleSet) {
        const ruleSetIndex = context.selectedRuleSetIndex;
        context.setRuleSets(prev => prev.map((rs, i) => 
          i === ruleSetIndex
            ? { ...rs, rules: [...rs.rules, parsedRule] }
            : rs
        ));
        
        return {
          success: true,
          message: `Parsed and added rule to ruleset`,
          parsedRule,
          humanReadable,
          addedToRuleSet: true,
          ruleSetIndex,
        };
      }
      
      return {
        success: true,
        parsedRule,
        humanReadable,
        addedToRuleSet: false,
      };
    }
    
    // -----------------------------------------------------------------------
    // Template Tools
    // -----------------------------------------------------------------------
    case 'get_template_info': {
      return {
        name: context.template.name,
        fileName: context.template.fileName,
        version: context.template.version,
        description: context.template.description,
        owner: context.template.owner,
        application: context.template.application,
        docs: context.template.docs,
        fieldCount: context.fields.length,
        ruleSetCount: context.ruleSets.length,
        checkedFieldCount: context.fields.filter(f => f.checked).length,
      };
    }
    
    case 'get_rulesets': {
      return context.ruleSets.map((rs, i) => ({
        index: i,
        name: rs.name,
        description: rs.description,
        tags: rs.tags,
        ruleCount: rs.rules.length,
        isSelected: i === context.selectedRuleSetIndex,
      }));
    }
    
    // -----------------------------------------------------------------------
    // Help & Documentation Tools
    // -----------------------------------------------------------------------
    case 'get_help': {
      // This is an async tool - we return a promise that will be handled specially
      const mode = args.mode === 'simple' ? 'simple' : 'expert';
      const helpFile = mode === 'simple' ? 'HELP.simple.md' : 'HELP.md';
      
      // Return a marker that indicates this is an async fetch operation
      // The actual fetch will be handled by the async executor
      return {
        _asyncFetch: true,
        url: `${window.location.origin}${import.meta.env.BASE_URL}${helpFile}`,
        mode,
      };
    }
    
    case 'fetch_template_docs': {
      const docsUrl = context.template.docs;
      
      if (!docsUrl) {
        return {
          success: false,
          error: 'This template does not have a documentation URL configured. The "docs" field is not set in the template metadata.',
        };
      }
      
      // Return a marker for async fetch operation
      return {
        _asyncFetch: true,
        url: docsUrl,
        mode: 'template_docs',
      };
    }
    
    case 'fetch_field_docs': {
      const fieldName = args.fieldName as string;
      const field = context.fields.find(f => f.name === fieldName);
      
      if (!field) {
        return {
          success: false,
          error: `Field "${fieldName}" not found in the template.`,
        };
      }
      
      if (!field.link) {
        return {
          success: false,
          error: `Field "${fieldName}" does not have a documentation link configured.`,
          field: {
            name: field.name,
            info: field.info,
            example: field.example,
          },
        };
      }
      
      // Return a marker for async fetch operation
      return {
        _asyncFetch: true,
        url: field.link,
        mode: 'field_docs',
        fieldName,
      };
    }
    
    // -----------------------------------------------------------------------
    // Registry & Template Loading Tools
    // -----------------------------------------------------------------------
    case 'search_registries': {
      const query = args.query as string;
      
      if (!context.searchRegistries) {
        throw new Error('Registry search is not available. The registry hook was not provided to the tool context.');
      }
      
      // Return a marker for async registry search
      return {
        _asyncRegistrySearch: true,
        query,
      };
    }
    
    case 'load_template_from_registry': {
      const packageName = args.packageName as string;
      const source = args.source as string;
      const version = args.version as string | undefined;
      
      if (!context.loadTemplateFromRegistry) {
        throw new Error('Template loading is not available. The registry hook was not provided to the tool context.');
      }
      
      // Return a marker for async template loading
      return {
        _asyncTemplateLoad: true,
        packageName,
        source,
        version,
      };
    }
    
    default:
      throw new Error(`Unknown tool: "${toolName}". Available tools: ${GUIDO_TOOLS.map(t => t.name).join(', ')}`);
  }
}
