/**
 * LLM Service - Using Vercel AI SDK for reliable multi-provider support
 * 
 * Supports: OpenAI, Anthropic, Google Gemini, Ollama (local)
 * The AI SDK handles all the complexity of tool calling and streaming correctly.
 */

import { generateText, streamText, tool, type ModelMessage, type ToolSet, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { LLMProvider } from '@/context/AIContext';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  provider: LLMProvider;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Tool definition that the LLM can call
 * Uses Zod schemas directly for type-safe tool input validation
 */
export interface ToolDefinition {
  name: string;
  description: string;
  /** Zod schema for tool input validation */
  inputSchema: z.ZodType;
  /** If true, this tool is only available in expert mode */
  expertOnly?: boolean;
}

/**
 * A tool call requested by the LLM
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool, to send back to the LLM
 */
export interface ToolResult {
  toolCallId: string;
  result: string;
  isError?: boolean;
}

/**
 * Extended chat response that may include tool calls
 */
export interface ChatResponseWithTools extends ChatResponse {
  toolCalls?: ToolCall[];
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop';
}

/**
 * Extended message type that can include tool results
 */
export interface ChatMessageWithTools extends ChatMessage {
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (response: ChatResponseWithTools) => void;
  onError: (error: Error) => void;
  onToolCall?: (toolCalls: ToolCall[]) => void;
}

// ============================================================================
// Provider Endpoints (for model fetching - AI SDK doesn't fetch model lists)
// ============================================================================

const PROVIDER_ENDPOINTS = {
  openai: {
    models: 'https://api.openai.com/v1/models',
  },
  anthropic: {
    models: 'https://api.anthropic.com/v1/models',
  },
  google: {
    models: 'https://generativelanguage.googleapis.com/v1/models',
  },
  ollama: {
    models: '/api/tags',
    version: '/api/version',
  },
};

// ============================================================================
// Provider Factory - Creates AI SDK provider instances
// ============================================================================

function getModel(
  provider: LLMProvider,
  apiKey: string,
  modelId: string,
  baseUrl?: string
) {
  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(modelId);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelId);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelId);
    }
    case 'ollama': {
      // Use OpenAI-compatible provider for Ollama (supports Zod 4)
      const ollama = createOpenAICompatible({
        name: 'ollama',
        baseURL: baseUrl || 'http://localhost:11434/v1',
      });
      return ollama.chatModel(modelId);
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

// ============================================================================
// Model Fetching (AI SDK doesn't have model listing, so we keep our own)
// ============================================================================

export async function checkOllamaAvailable(baseUrl: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}${PROVIDER_ENDPOINTS.ollama.version}`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchModels(
  provider: LLMProvider,
  apiKey: string,
  baseUrl?: string
): Promise<ModelInfo[]> {
  switch (provider) {
    case 'openai':
      return fetchOpenAIModels(apiKey);
    case 'anthropic':
      return fetchAnthropicModels(apiKey);
    case 'google':
      return fetchGoogleModels(apiKey);
    case 'ollama':
      return fetchOllamaModels(baseUrl || 'http://localhost:11434');
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch(PROVIDER_ENDPOINTS.openai.models, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  interface OpenAIModel {
    id: string;
    owned_by: string;
  }

  const data = await response.json() as { data: OpenAIModel[] };
  
  // Filter to chat models only
  const chatModels = data.data.filter((m) =>
    m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3')
  );

  return chatModels
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({
      id: m.id,
      name: m.id,
      description: m.owned_by,
      provider: 'openai' as const,
    }));
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch(PROVIDER_ENDPOINTS.anthropic.models, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    interface AnthropicModel {
      id: string;
      display_name?: string;
      type: string;
    }

    const data = await response.json() as { data: AnthropicModel[] };
    
    return data.data.map((m) => ({
      id: m.id,
      name: m.display_name || m.id,
      description: m.type,
      provider: 'anthropic' as const,
    }));
  } catch {
    // Anthropic doesn't always expose models endpoint - return common models
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' as const },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' as const },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' as const },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' as const },
    ];
  }
}

async function fetchGoogleModels(apiKey: string): Promise<ModelInfo[]> {
  const url = `${PROVIDER_ENDPOINTS.google.models}?key=${apiKey}`;
  
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  interface GoogleModel {
    name: string;
    displayName: string;
    description: string;
    supportedGenerationMethods: string[];
  }

  const data = await response.json() as { models: GoogleModel[] };
  
  const chatModels = data.models.filter((m) =>
    m.supportedGenerationMethods?.includes('generateContent')
  );

  return chatModels.map((m) => ({
    id: m.name.replace('models/', ''),
    name: m.displayName,
    description: m.description,
    provider: 'google' as const,
  }));
}

async function fetchOllamaModels(baseUrl: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}${PROVIDER_ENDPOINTS.ollama.models}`);

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  interface OllamaModel {
    name: string;
    model: string;
    size: number;
  }

  const data = await response.json() as { models: OllamaModel[] };

  return data.models.map((m) => ({
    id: m.name,
    name: m.name,
    description: `${(m.size / 1e9).toFixed(1)}GB`,
    provider: 'ollama' as const,
  }));
}

// ============================================================================
// Convert our tool definitions to AI SDK format
// ============================================================================

function convertToolsToAISDK(tools: ToolDefinition[]): ToolSet {
  const result: ToolSet = {};
  
  for (const t of tools) {
    result[t.name] = tool({
      description: t.description,
      inputSchema: t.inputSchema,
      // No execute - we handle tool execution manually
    });
  }
  
  return result;
}

// ============================================================================
// Convert messages to AI SDK ModelMessage format
// ============================================================================
// Convert messages to AI SDK ModelMessage format (exported for testing)
// ============================================================================

export function convertMessagesToAISDK(messages: ChatMessageWithTools[]) {
  // We return any[] because constructing the exact ModelMessage type is complex
  // and the AI SDK is very flexible about message formats
  const result: unknown[] = [];
  
  for (const msg of messages) {
    if (msg.role === 'system') {
      result.push({ role: 'system', content: msg.content });
    } else if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      // Check if this message has tool calls
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        // Build assistant message with tool calls
        // AI SDK v5 uses 'input' for tool call arguments
        const content: unknown[] = [];
        
        // Always add text content if present (even if empty, some models expect it)
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool-call',
            toolCallId: tc.id,
            toolName: tc.name,
            input: tc.arguments,
          });
        }
        
        // Only push if we have content parts
        if (content.length > 0) {
          result.push({
            role: 'assistant',
            content,
          });
        }
        
        // If we have tool results, add them as a tool message
        // AI SDK v5 requires output to be { type: 'text'|'json', value: ... }
        if (msg.toolResults && msg.toolResults.length > 0) {
          const toolContent: unknown[] = [];
          
          for (const tr of msg.toolResults) {
            const toolCall = msg.toolCalls.find(tc => tc.id === tr.toolCallId);
            
            // Try to parse result as JSON, otherwise use as text
            let output: { type: string; value: unknown };
            try {
              const parsed: unknown = JSON.parse(tr.result);
              output = { type: 'json', value: parsed };
            } catch {
              output = { type: 'text', value: tr.result };
            }
            
            toolContent.push({
              type: 'tool-result',
              toolCallId: tr.toolCallId,
              toolName: toolCall?.name || 'unknown',
              output,
            });
          }
          
          result.push({
            role: 'tool',
            content: toolContent,
          });
        }
      } else {
        // Regular assistant message (no tool calls)
        result.push({ role: 'assistant', content: msg.content });
      }
    }
  }
  
  logger.debug(`[AI Chat] Converted ${messages.length} messages to ${result.length} AI SDK messages`, 
    result.map((m: unknown) => {
      const msg = m as { role: string; content: unknown };
      return {
        role: msg.role,
        contentType: Array.isArray(msg.content) ? 'array' : typeof msg.content,
        contentLength: Array.isArray(msg.content) ? msg.content.length : String(msg.content).length,
      };
    })
  );
  
  return result as ModelMessage[];
}

// ============================================================================
// Main Chat Function - Using AI SDK generateText
// ============================================================================

export async function sendChatMessage(
  provider: LLMProvider,
  apiKey: string,
  modelId: string,
  messages: ChatMessageWithTools[],
  baseUrl?: string,
  options?: { tools?: ToolDefinition[] }
): Promise<ChatResponseWithTools> {
  logger.debug(`[AI Chat] Sending message to ${provider}/${modelId}`, {
    messageCount: messages.length,
    hasTools: !!options?.tools,
    toolCount: options?.tools?.length ?? 0,
  });
  
  const model = getModel(provider, apiKey, modelId, baseUrl);
  const aiMessages = convertMessagesToAISDK(messages);
  
  const aiTools = options?.tools ? convertToolsToAISDK(options.tools) : undefined;
  
  const result = await generateText({
    model: model as LanguageModel,
    messages: aiMessages,
    maxOutputTokens: 4096,
    tools: aiTools,
  });
  
  // Extract tool calls from the response
  const toolCalls: ToolCall[] = result.toolCalls?.map((tc) => ({
    id: tc.toolCallId,
    name: tc.toolName,
    arguments: (tc as { input?: Record<string, unknown> }).input ?? {},
  })) || [];
  
  // Determine stop reason
  let stopReason: ChatResponseWithTools['stopReason'] = 'end_turn';
  if (result.finishReason === 'tool-calls') {
    stopReason = 'tool_use';
  } else if (result.finishReason === 'length') {
    stopReason = 'max_tokens';
  } else if (result.finishReason === 'stop') {
    stopReason = 'stop';
  }
  
  // Get usage safely - AI SDK v5 uses inputTokens/outputTokens
  const usage = result.usage ? {
    promptTokens: result.usage.inputTokens ?? 0,
    completionTokens: result.usage.outputTokens ?? 0,
    totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
  } : undefined;
  
  const response = {
    content: result.text,
    model: modelId,
    usage,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    stopReason,
  };
  
  logger.debug(`[AI Chat] Response received`, {
    contentLength: result.text.length,
    toolCallCount: toolCalls.length,
    stopReason,
    usage,
  });
  
  if (toolCalls.length > 0) {
    logger.info(`[AI Chat] Tool calls requested:`, toolCalls.map(tc => tc.name));
  }
  
  return response;
}

// ============================================================================
// Streaming Chat Function - Using AI SDK streamText
// ============================================================================

export async function streamChatMessage(
  provider: LLMProvider,
  apiKey: string,
  modelId: string,
  messages: ChatMessageWithTools[],
  callbacks: StreamCallbacks,
  baseUrl?: string,
  options?: { tools?: ToolDefinition[] }
): Promise<void> {
  try {
    const model = getModel(provider, apiKey, modelId, baseUrl);
    const aiMessages = convertMessagesToAISDK(messages);
    const aiTools = options?.tools ? convertToolsToAISDK(options.tools) : undefined;
    
    const result = streamText({
      model: model as LanguageModel,
      messages: aiMessages,
      maxOutputTokens: 4096,
      tools: aiTools,
    });
    
    let fullText = '';
    const toolCalls: ToolCall[] = [];
    
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        // AI SDK v5 uses 'text' property
        const text = (part as { text: string }).text;
        fullText += text;
        callbacks.onToken(text);
      } else if (part.type === 'tool-call') {
        toolCalls.push({
          id: part.toolCallId,
          name: part.toolName,
          arguments: (part as { input?: Record<string, unknown> }).input ?? {},
        });
      }
    }
    
    // Notify about tool calls if any
    if (toolCalls.length > 0 && callbacks.onToolCall) {
      callbacks.onToolCall(toolCalls);
    }
    
    // Get final usage
    const usage = await result.usage;
    const finishReason = await result.finishReason;
    
    // Determine stop reason
    let stopReason: ChatResponseWithTools['stopReason'] = 'end_turn';
    if (finishReason === 'tool-calls') {
      stopReason = 'tool_use';
    } else if (finishReason === 'length') {
      stopReason = 'max_tokens';
    } else if (finishReason === 'stop') {
      stopReason = 'stop';
    }
    
    // Get usage safely - AI SDK v5 uses inputTokens/outputTokens
    const usageResult = usage ? {
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
      totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
    } : undefined;
    
    callbacks.onComplete({
      content: fullText,
      model: modelId,
      usage: usageResult,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason,
    });
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}
