/**
 * Shared types for MCP tool handlers
 * 
 * Note: The MCP SDK's McpServer.registerTool() uses complex conditional generic types
 * that cause "Type instantiation is excessively deep" errors when the server instance
 * is passed between modules. This is a known TypeScript limitation.
 * 
 * Solution: We use a simplified interface that matches the registerTool signature
 * but without the deep generic chains. This provides proper typing while avoiding
 * the TypeScript compiler hanging on type resolution.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ============================================================================
// Tool Registration Types
// ============================================================================

/**
 * Simplified tool registration interface that avoids deep type instantiation.
 * Matches McpServer.registerTool() signature but with simpler generics.
 */
export interface ToolRegistrar {
  registerTool(
    name: string,
    config: {
      title: string;
      description: string;
      inputSchema: Record<string, z.ZodType>;
    },
    handler: (args: Record<string, unknown>) => Promise<ToolResult>
  ): void;
}

export type ToolContext = {
  server: ToolRegistrar;
  getTemplatePath: (providedPath?: string) => string;
  /** Set the active template path for subsequent operations */
  setTemplatePath?: (newPath: string) => void;
  /** Get the current active template path (undefined if not set) */
  getCurrentTemplatePath?: () => string | undefined;
};

/**
 * Cast McpServer to ToolRegistrar to break the type instantiation chain.
 * The runtime behavior is identical - this only affects type checking.
 */
export function asToolRegistrar(server: McpServer): ToolRegistrar {
  return server as unknown as ToolRegistrar;
}

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};
