import { createContext } from 'react';
import type { ChatMessageWithTools } from '@/services/llmService';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // For Ollama or custom endpoints
}

export interface ChatPosition {
  x: number;
  y: number;
}

export type ChatPhase = 'idle' | 'input' | 'thinking' | 'tool-calling' | 'responding' | 'done';

export interface ChatHistoryItem {
  id: string;
  timestamp: number;
  userMessage: string;
  assistantResponse: string;
  toolsUsed?: string[];
}

export interface AIContextType {
  config: LLMConfig | null;
  setConfig: (config: LLMConfig | null) => void;
  isConfigured: boolean;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  chatPosition: ChatPosition;
  openChatAt: (position: ChatPosition) => void;
  // Chat phase for thinking bubble on Guido
  chatPhase: ChatPhase;
  setChatPhase: (phase: ChatPhase) => void;
  currentToolName: string | null;
  setCurrentToolName: (name: string | null) => void;
  // Response for speech bubble on Guido
  chatResponse: string;
  setChatResponse: (response: string) => void;
  showFullResponse: boolean;
  setShowFullResponse: (show: boolean) => void;
  // Chat history (for viewing past conversations)
  chatHistory: ChatHistoryItem[];
  addChatHistoryItem: (item: Omit<ChatHistoryItem, 'id' | 'timestamp'>) => void;
  clearChatHistory: () => void;
  // Session messages (for maintaining context within current conversation)
  sessionMessages: ChatMessageWithTools[];
  setSessionMessages: (messages: ChatMessageWithTools[]) => void;
  clearSession: () => void;
  // Speech synthesis for Guido to speak responses
  speechEnabled: boolean;
  setSpeechEnabled: (enabled: boolean) => void;
  isSpeaking: boolean;
  speakResponse: (text: string) => void;
  speakResponseAsync: (text: string) => Promise<void>;
  cancelSpeech: () => void;
  // Speech settings
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  speechVolume: number;
  setSpeechVolume: (volume: number) => void;
}

export const AIContext = createContext<AIContextType | undefined>(undefined);

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  ollama: 'Ollama (Local)',
};

export const PROVIDER_PLACEHOLDER_KEYS: Record<LLMProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  google: 'AIza...',
  ollama: '', // No key needed
};
