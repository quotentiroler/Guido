import React, { useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import localforage from 'localforage';
import { AIContext, LLMConfig, ChatPosition, ChatPhase, ChatHistoryItem } from '@/context/AIContext';
import type { ChatMessageWithTools } from '@/services/llmService';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

const STORAGE_KEY = 'guido-ai-config';
const HISTORY_STORAGE_KEY = 'guido-chat-history';
const SPEECH_ENABLED_KEY = 'guido-speech-enabled';
const SPEECH_RATE_KEY = 'guido-speech-rate';
const SPEECH_VOLUME_KEY = 'guido-speech-volume';

interface AIProviderProps {
  children: ReactNode;
}

export const AIProvider: React.FC<AIProviderProps> = ({ children }) => {
  const [config, setConfigState] = useState<LLMConfig | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPosition, setChatPosition] = useState<ChatPosition>({ x: 0, y: 0 });
  const [chatPhase, setChatPhase] = useState<ChatPhase>('idle');
  const [currentToolName, setCurrentToolName] = useState<string | null>(null);
  const [chatResponse, setChatResponse] = useState<string>('');
  const [showFullResponse, setShowFullResponse] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [sessionMessages, setSessionMessages] = useState<ChatMessageWithTools[]>([]);
  const [speechEnabled, setSpeechEnabledState] = useState(false);
  const [speechRate, setSpeechRateState] = useState(1.0);
  const [speechVolume, setSpeechVolumeState] = useState(1.0);
  
  // Speech synthesis hook
  const speech = useSpeechSynthesis();
  const lastSpokenRef = useRef<string>('');

  // Load config and history from localforage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [storedConfig, storedHistory, storedSpeechEnabled, storedSpeechRate, storedSpeechVolume] = await Promise.all([
          localforage.getItem<LLMConfig>(STORAGE_KEY),
          localforage.getItem<ChatHistoryItem[]>(HISTORY_STORAGE_KEY),
          localforage.getItem<boolean>(SPEECH_ENABLED_KEY),
          localforage.getItem<number>(SPEECH_RATE_KEY),
          localforage.getItem<number>(SPEECH_VOLUME_KEY),
        ]);
        if (storedConfig) {
          setConfigState(storedConfig);
        }
        if (storedHistory) {
          setChatHistory(storedHistory);
        }
        if (storedSpeechEnabled !== null) {
          setSpeechEnabledState(storedSpeechEnabled);
          // Sync with speech hook
          speech.setEnabled(storedSpeechEnabled);
        }
        if (storedSpeechRate !== null) {
          setSpeechRateState(storedSpeechRate);
        }
        if (storedSpeechVolume !== null) {
          setSpeechVolumeState(storedSpeechVolume);
        }
      } catch (e) {
        console.warn('Failed to load AI data from localforage:', e);
      }
    };
    void loadData();
  }, [speech]);

  const setConfig = useCallback((newConfig: LLMConfig | null) => {
    setConfigState(newConfig);
    if (newConfig) {
      void localforage.setItem(STORAGE_KEY, newConfig);
    } else {
      void localforage.removeItem(STORAGE_KEY);
    }
  }, []);

  const isConfigured = config !== null && (
    config.provider === 'ollama' || // Ollama doesn't need API key
    Boolean(config.apiKey && config.apiKey.length > 0)
  );

  const openChatAt = useCallback((position: ChatPosition) => {
    setChatPosition(position);
    setChatPhase('input');
    setIsChatOpen(true);
  }, []);

  const addChatHistoryItem = useCallback((item: Omit<ChatHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: ChatHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setChatHistory(prev => {
      const updated = [newItem, ...prev].slice(0, 100); // Keep last 100 items
      void localforage.setItem(HISTORY_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatHistory([]);
    void localforage.removeItem(HISTORY_STORAGE_KEY);
  }, []);

  const clearSession = useCallback(() => {
    setSessionMessages([]);
  }, []);

  const setSpeechEnabled = useCallback((enabled: boolean) => {
    setSpeechEnabledState(enabled);
    speech.setEnabled(enabled); // Sync with speech hook
    void localforage.setItem(SPEECH_ENABLED_KEY, enabled);
    if (!enabled) {
      speech.cancel();
    }
  }, [speech]);

  const speakResponse = useCallback((text: string) => {
    if (speechEnabled && text && text !== lastSpokenRef.current) {
      lastSpokenRef.current = text;
      speech.speak(text, { rate: speechRate, volume: speechVolume });
    }
  }, [speechEnabled, speech, speechRate, speechVolume]);

  const speakResponseAsync = useCallback(async (text: string): Promise<void> => {
    if (speechEnabled && text && text !== lastSpokenRef.current) {
      lastSpokenRef.current = text;
      await speech.speakAsync(text, { rate: speechRate, volume: speechVolume });
    }
  }, [speechEnabled, speech, speechRate, speechVolume]);

  const cancelSpeech = useCallback(() => {
    speech.cancel();
    lastSpokenRef.current = '';
  }, [speech]);

  const setSpeechRate = useCallback((rate: number) => {
    setSpeechRateState(rate);
    void localforage.setItem(SPEECH_RATE_KEY, rate);
  }, []);

  const setSpeechVolume = useCallback((volume: number) => {
    setSpeechVolumeState(volume);
    void localforage.setItem(SPEECH_VOLUME_KEY, volume);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    config,
    setConfig,
    isConfigured,
    isChatOpen,
    setIsChatOpen,
    chatPosition,
    openChatAt,
    chatPhase,
    setChatPhase,
    currentToolName,
    setCurrentToolName,
    chatResponse,
    setChatResponse,
    showFullResponse,
    setShowFullResponse,
    chatHistory,
    addChatHistoryItem,
    clearChatHistory,
    sessionMessages,
    setSessionMessages,
    clearSession,
    speechEnabled,
    setSpeechEnabled,
    isSpeaking: speech.isSpeaking,
    speakResponse,
    speakResponseAsync,
    cancelSpeech,
    speechRate,
    setSpeechRate,
    speechVolume,
    setSpeechVolume,
  }), [
    config,
    setConfig,
    isConfigured,
    isChatOpen,
    chatPosition,
    openChatAt,
    chatPhase,
    currentToolName,
    chatResponse,
    showFullResponse,
    chatHistory,
    addChatHistoryItem,
    clearChatHistory,
    sessionMessages,
    clearSession,
    speechEnabled,
    setSpeechEnabled,
    speech.isSpeaking,
    speakResponse,
    speakResponseAsync,
    cancelSpeech,
    speechRate,
    setSpeechRate,
    speechVolume,
    setSpeechVolume,
  ]);

  return (
    <AIContext.Provider value={contextValue}>
      {children}
    </AIContext.Provider>
  );
};
