import { describe, it, expect } from 'vitest';
import { convertMessagesToAISDK, ChatMessageWithTools } from '../services/llmService';

describe('convertMessagesToAISDK', () => {
  it('should convert simple user message', () => {
    const messages: ChatMessageWithTools[] = [
      { role: 'user', content: 'Hello' },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('should convert simple assistant message', () => {
    const messages: ChatMessageWithTools[] = [
      { role: 'assistant', content: 'Hi there!' },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toEqual([
      { role: 'assistant', content: 'Hi there!' },
    ]);
  });

  it('should convert system message', () => {
    const messages: ChatMessageWithTools[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toEqual([
      { role: 'system', content: 'You are a helpful assistant.' },
    ]);
  });

  it('should convert assistant message with tool calls (no results yet)', () => {
    const messages: ChatMessageWithTools[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_123',
            name: 'get_field_info',
            arguments: { fieldName: 'test' },
          },
        ],
      },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'get_field_info',
            input: { fieldName: 'test' },
          },
        ],
      },
    ]);
  });

  it('should convert assistant message with tool calls AND tool results', () => {
    // This is how AIChatOverlay sends messages - tool calls and results in same message
    const messages: ChatMessageWithTools[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_123',
            name: 'get_field_info',
            arguments: { fieldName: 'test' },
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_123',
            result: JSON.stringify({ success: true, data: 'test result' }),
          },
        ],
      },
    ];

    const result = convertMessagesToAISDK(messages);

    // Should produce 2 messages: assistant with tool-call, then tool with tool-result
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call_123',
          toolName: 'get_field_info',
          input: { fieldName: 'test' },
        },
      ],
    });
    expect(result[1]).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_123',
          toolName: 'get_field_info',
          output: { type: 'json', value: { success: true, data: 'test result' } },
        },
      ],
    });
  });

  it('should handle full conversation with tool calls and results', () => {
    const messages: ChatMessageWithTools[] = [
      { role: 'system', content: 'You are Guido.' },
      { role: 'user', content: 'What is the value of field X?' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_456',
            name: 'get_field_info',
            arguments: { fieldName: 'X' },
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_456',
            result: '{"fieldName": "X", "value": "42"}',
          },
        ],
      },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: 'system', content: 'You are Guido.' });
    expect(result[1]).toEqual({ role: 'user', content: 'What is the value of field X?' });
    expect(result[2]).toEqual({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call_456',
          toolName: 'get_field_info',
          input: { fieldName: 'X' },
        },
      ],
    });
    expect(result[3]).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_456',
          toolName: 'get_field_info',
          output: { type: 'json', value: { fieldName: 'X', value: '42' } },
        },
      ],
    });
  });

  it('should handle multiple tool calls in one message', () => {
    const messages: ChatMessageWithTools[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'get_field_info',
            arguments: { fieldName: 'A' },
          },
          {
            id: 'call_2',
            name: 'get_field_info',
            arguments: { fieldName: 'B' },
          },
        ],
      },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'get_field_info',
            input: { fieldName: 'A' },
          },
          {
            type: 'tool-call',
            toolCallId: 'call_2',
            toolName: 'get_field_info',
            input: { fieldName: 'B' },
          },
        ],
      },
    ]);
  });

  it('should handle multiple tool calls with multiple results', () => {
    const messages: ChatMessageWithTools[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'get_field_info',
            arguments: { fieldName: 'A' },
          },
          {
            id: 'call_2',
            name: 'get_field_info',
            arguments: { fieldName: 'B' },
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_1',
            result: '{"value": "A"}',
          },
          {
            toolCallId: 'call_2',
            result: '{"value": "B"}',
          },
        ],
      },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'get_field_info',
          input: { fieldName: 'A' },
        },
        {
          type: 'tool-call',
          toolCallId: 'call_2',
          toolName: 'get_field_info',
          input: { fieldName: 'B' },
        },
      ],
    });
    expect(result[1]).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_1',
          toolName: 'get_field_info',
          output: { type: 'json', value: { value: 'A' } },
        },
        {
          type: 'tool-result',
          toolCallId: 'call_2',
          toolName: 'get_field_info',
          output: { type: 'json', value: { value: 'B' } },
        },
      ],
    });
  });

  it('should handle assistant messages with empty tool calls array (becomes regular assistant message)', () => {
    const messages: ChatMessageWithTools[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: '', toolCalls: [] },
      { role: 'assistant', content: 'Hi!' },
    ];

    const result = convertMessagesToAISDK(messages);

    // Empty toolCalls means it's treated as a regular assistant message with empty content
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(result[1]).toEqual({ role: 'assistant', content: '' }); // Empty content preserved
    expect(result[2]).toEqual({ role: 'assistant', content: 'Hi!' });
  });

  it('should include text content with tool calls', () => {
    const messages: ChatMessageWithTools[] = [
      {
        role: 'assistant',
        content: 'Let me check that for you.',
        toolCalls: [
          {
            id: 'call_123',
            name: 'get_field_info',
            arguments: { fieldName: 'test' },
          },
        ],
      },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check that for you.' },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'get_field_info',
            input: { fieldName: 'test' },
          },
        ],
      },
    ]);
  });

  it('should handle multi-turn conversation with tool calls correctly', () => {
    // This simulates what happens in the UI:
    // 1. User asks something
    // 2. Assistant responds with tool call
    // 3. Tool results are attached to the assistant message
    // 4. On second API call, we need to pass all of this correctly

    const messages: ChatMessageWithTools[] = [
      { role: 'system', content: 'You are Guido, a helpful assistant.' },
      { role: 'user', content: 'What fields are available?' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'toolu_01ABC',
            name: 'list_fields',
            arguments: {},
          },
        ],
        toolResults: [
          {
            toolCallId: 'toolu_01ABC',
            result: JSON.stringify({ fields: ['name', 'age', 'email'] }),
          },
        ],
      },
    ];

    const result = convertMessagesToAISDK(messages);

    // Should produce 4 messages: system, user, assistant with tool-call, tool with tool-result
    expect(result).toHaveLength(4);
    
    // System message
    expect(result[0]).toEqual({
      role: 'system',
      content: 'You are Guido, a helpful assistant.',
    });
    
    // User message
    expect(result[1]).toEqual({
      role: 'user',
      content: 'What fields are available?',
    });
    
    // Assistant message with tool call
    expect(result[2]).toEqual({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'toolu_01ABC',
          toolName: 'list_fields',
          input: {},
        },
      ],
    });
    
    // Tool result message
    expect(result[3]).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'toolu_01ABC',
          toolName: 'list_fields',
          output: { type: 'json', value: { fields: ['name', 'age', 'email'] } },
        },
      ],
    });
  });

  it('should handle non-JSON tool result as text', () => {
    const messages: ChatMessageWithTools[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_123',
            name: 'get_help',
            arguments: {},
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_123',
            result: 'This is plain text help message, not JSON.',
          },
        ],
      },
    ];

    const result = convertMessagesToAISDK(messages);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_123',
          toolName: 'get_help',
          output: { type: 'text', value: 'This is plain text help message, not JSON.' },
        },
      ],
    });
  });
});
