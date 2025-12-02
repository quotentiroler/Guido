#!/usr/bin/env node
/**
 * Guido MCP Server
 * 
 * MCP Server for managing guido.json templates - CRUD operations for fields and rules.
 * Enables LLMs to read, modify, and validate configuration templates.
 * 
 * Usage:
 *   # With an existing template (default template for all operations)
 *   npx guido-mcp --template ./path/to/template.guido.json
 *   
 *   # Without a template (use create_template to start fresh, or provide filePath per tool call)
 *   npx guido-mcp
 *   
 * Or via MCP config:
 *   {
 *     "mcpServers": {
 *       "guido": {
 *         "command": "npx",
 *         "args": ["tsx", "./mcp-server/src/index.ts", "--template", "./templates/my-template.guido.json"]
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

import { registerAllTools } from './dynamic-tools.js';
import { asToolRegistrar, ToolContext } from './tools/types.js';

// Keep legacy tool registrations for tools not yet migrated to dynamic
import {
  registerAnalysisTools,
  registerImportExportTools,
  registerChangeTrackingTools,
} from './tools/index.js';

// ============================================================================
// PARSE COMMAND LINE ARGUMENTS
// ============================================================================

const args = process.argv.slice(2);
let templatePath: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--template' && args[i + 1]) {
    templatePath = args[i + 1];
    i++;
  }
}

// ============================================================================
// CREATE MCP SERVER
// ============================================================================

const server = new McpServer(
  {
    name: 'guido-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: { listChanged: true },
      resources: {},
    },
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTemplatePath(providedPath?: string): string {
  const p = providedPath || templatePath;
  if (!p) {
    throw new Error('No template path provided. Use set_template, create_template, or provide filePath parameter.');
  }
  return path.resolve(p);
}

function setTemplatePath(newPath: string): void {
  templatePath = path.resolve(newPath);
}

function getCurrentTemplatePath(): string | undefined {
  return templatePath;
}

// ============================================================================
// REGISTER ALL TOOLS
// ============================================================================

const context: ToolContext = { 
  server: asToolRegistrar(server), 
  getTemplatePath,
  setTemplatePath,
  getCurrentTemplatePath,
};

// Core tools (field, rule, template, validation, export) - dynamically registered
registerAllTools(context);

// Legacy tools not yet migrated - still registered manually
registerAnalysisTools(context);
registerImportExportTools(context);
registerChangeTrackingTools(context);

// ============================================================================
// REGISTER RESOURCES
// ============================================================================

// Get the directory of this file to find README.md
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const readmePath = path.resolve(__dirname, '..', 'README.md');

// Register README.md as a resource for LLM context
server.registerResource(
  'readme',
  'file://readme.md',
  {
    description: 'Guido MCP Server documentation and usage instructions',
    mimeType: 'text/markdown',
  },
  async () => {
    try {
      const content = await fs.promises.readFile(readmePath, 'utf-8');
      return {
        contents: [{
          uri: 'file://readme.md',
          text: content,
          mimeType: 'text/markdown',
        }],
      };
    } catch {
      return {
        contents: [{
          uri: 'file://readme.md',
          text: '# Guido MCP Server\n\nREADME.md not found.',
          mimeType: 'text/markdown',
        }],
      };
    }
  }
);

// ============================================================================
// START SERVER
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr so it doesn't interfere with MCP protocol
  console.error(`Guido MCP Server started${templatePath ? ` with template: ${templatePath}` : ''}`);
}

main().catch((error) => {
  console.error('Failed to start Guido MCP Server:', error);
  process.exit(1);
});
