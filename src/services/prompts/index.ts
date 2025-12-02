/**
 * Guido AI System Prompts
 * 
 * Separated into dedicated files for easier maintenance and editing.
 * Tool lists are dynamically generated from GUIDO_TOOLS definitions.
 */

export { EXPERT_SYSTEM_PROMPT } from './expertSystemPrompt';
export { SIMPLE_SYSTEM_PROMPT } from './simpleSystemPrompt';
export { SPEECH_GUIDELINES, FIELD_RANGE_DOCS } from './sharedPrompt';

import { EXPERT_SYSTEM_PROMPT } from './expertSystemPrompt';
import { SIMPLE_SYSTEM_PROMPT } from './simpleSystemPrompt';

export interface TemplateContext {
  name: string;
  fileName?: string;
  version?: string;
  description?: string;
  owner?: string;
  application?: string;
  fieldCount: number;
  ruleCount: number;
}

/**
 * Tool definition interface (matches the one in guidoTools.ts)
 */
interface ToolDefinition {
  name: string;
  description: string;
}

/**
 * Generate a formatted tool list section for the system prompt
 */
export function formatToolList(tools: ToolDefinition[]): string {
  const toolLines = tools.map(t => `- **${t.name}**: ${t.description}`);
  return `## Available Tools\n${toolLines.join('\n')}`;
}

/**
 * Get the appropriate system prompt based on expert mode and current template context
 * 
 * @param isExpertMode - Whether to use expert or simple mode
 * @param templateContext - Optional current template information
 * @param tools - Optional tool definitions to include in the prompt
 */
export function getSystemPrompt(
  isExpertMode: boolean, 
  templateContext?: TemplateContext,
  tools?: ToolDefinition[]
): string {
  const basePrompt = isExpertMode ? EXPERT_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT;
  
  let prompt = basePrompt;
  
  // Add dynamic tool list if provided
  if (tools && tools.length > 0) {
    prompt += '\n\n' + formatToolList(tools);
  }
  
  // Add current template context if provided
  if (templateContext) {
    const templateInfo = `

## Current Template Context
- **Name**: ${templateContext.name || 'Untitled'}
- **File**: ${templateContext.fileName || 'Not saved'}
${templateContext.version ? `- **Version**: ${templateContext.version}` : ''}
${templateContext.description ? `- **Description**: ${templateContext.description}` : ''}
${templateContext.owner ? `- **Owner**: ${templateContext.owner}` : ''}
${templateContext.application ? `- **Application**: ${templateContext.application}` : ''}
- **Fields**: ${templateContext.fieldCount} configuration fields
- **Rules**: ${templateContext.ruleCount} conditional rules
`;
    prompt += templateInfo;
  }
  
  return prompt;
}
