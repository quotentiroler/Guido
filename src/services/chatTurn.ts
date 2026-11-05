import type { ChatMessageWithTools, ChatResponseWithTools, ToolCall, ToolResult } from '@/services/llmService';

export interface ChatTurnDeps {
  send: (messages: ChatMessageWithTools[]) => Promise<ChatResponseWithTools>;
  executeTool: (toolCall: ToolCall) => Promise<ToolResult>;
  onToolCall: (toolName: string) => void;
  toolCallDelayMs?: number;
}

export interface ChatTurnResult {
  content: string;
  messages: ChatMessageWithTools[];
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function runChatTurn(
  messages: ChatMessageWithTools[],
  { send, executeTool, onToolCall, toolCallDelayMs = 100 }: ChatTurnDeps
): Promise<ChatTurnResult> {
  const workingMessages = [...messages];

  for (;;) {
    const result = await send(workingMessages);

    if (!result.toolCalls || result.toolCalls.length === 0) {
      workingMessages.push({ role: 'assistant', content: result.content });
      return { content: result.content, messages: workingMessages };
    }

    const assistantMessage: ChatMessageWithTools = {
      role: 'assistant',
      content: result.content,
      toolCalls: result.toolCalls,
    };
    workingMessages.push(assistantMessage);

    const toolResults: ToolResult[] = [];
    for (const toolCall of result.toolCalls) {
      onToolCall(toolCall.name);
      await wait(toolCallDelayMs);
      toolResults.push(await executeTool(toolCall));
    }
    assistantMessage.toolResults = toolResults;
  }
}

export function uniqueToolNames(toolNames: string[]): string[] | undefined {
  return toolNames.length > 0 ? [...new Set(toolNames)] : undefined;
}
