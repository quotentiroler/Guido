import { describe, it, expect, vi } from 'vitest';
import { runChatTurn, uniqueToolNames } from '@/services/chatTurn';
import type { ChatMessageWithTools, ChatResponseWithTools, ToolCall } from '@/services/llmService';

const response = (content: string, toolCalls?: ToolCall[]): ChatResponseWithTools => ({ content, model: 'test', toolCalls });
const call = (id: string, name: string): ToolCall => ({ id, name, arguments: {} });

const baseMessages: ChatMessageWithTools[] = [
  { role: 'system', content: 'sys' },
  { role: 'user', content: 'hi' },
];

describe('runChatTurn', () => {
  it('returns the reply directly when the model calls no tools', async () => {
    const send = vi.fn().mockResolvedValue(response('done'));
    const executeTool = vi.fn();

    const turn = await runChatTurn(baseMessages, { send, executeTool, onToolCall: vi.fn(), toolCallDelayMs: 0 });

    expect(turn.content).toBe('done');
    expect(turn.messages).toEqual([...baseMessages, { role: 'assistant', content: 'done' }]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('runs every requested tool in order and feeds the results back until the model stops', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(response('', [call('1', 'a'), call('2', 'b')]))
      .mockResolvedValueOnce(response('', [call('3', 'a')]))
      .mockResolvedValueOnce(response('final'));
    const executeTool = vi.fn((tc: ToolCall) => Promise.resolve({ toolCallId: tc.id, result: `ran ${tc.name}` }));
    const onToolCall = vi.fn();

    const turn = await runChatTurn(baseMessages, { send, executeTool, onToolCall, toolCallDelayMs: 0 });

    expect(onToolCall.mock.calls).toEqual([['a'], ['b'], ['a']]);
    expect(send).toHaveBeenCalledTimes(3);
    expect(turn.content).toBe('final');
    expect(turn.messages).toHaveLength(baseMessages.length + 3);
    expect(turn.messages[2].toolResults).toEqual([
      { toolCallId: '1', result: 'ran a' },
      { toolCallId: '2', result: 'ran b' },
    ]);
    expect(turn.messages[3].toolResults).toEqual([{ toolCallId: '3', result: 'ran a' }]);
    expect(baseMessages).toHaveLength(2);
  });

  it('propagates a failing send so the caller can report it', async () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(runChatTurn(baseMessages, { send, executeTool: vi.fn(), onToolCall: vi.fn() })).rejects.toThrow('offline');
  });
});

describe('uniqueToolNames', () => {
  it('dedupes names and returns undefined when no tool ran', () => {
    expect(uniqueToolNames(['a', 'b', 'a'])).toEqual(['a', 'b']);
    expect(uniqueToolNames([])).toBeUndefined();
  });
});
