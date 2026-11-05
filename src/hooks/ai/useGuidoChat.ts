import { useCallback, useRef, useState } from 'react';
import { sendChatMessage, type ChatMessageWithTools } from '@/services/llmService';
import { executeToolCalls, getToolsForMode, type GuidoToolContext, type RegistrySearchItem } from '@/services/guidoTools';
import { getSystemPrompt } from '@/services/prompts';
import { runChatTurn, uniqueToolNames } from '@/services/chatTurn';
import { type ChatPhase } from '@/context/AIContext';
import { useFieldContext } from '@/hooks/useFieldContext';
import { useTemplateContext } from '@/hooks/useTemplateContext';
import { useAI } from '@/hooks/useAI';
import { useAppContext } from '@/hooks/useAppContext';
import useRegistry, { type SearchResultItem } from '@/hooks/useRegistry';
import { useSpeechRecognition } from '@/hooks/ai/useSpeechRecognition';

const CHAT_ERROR_MESSAGE = 'Sorry, something went wrong. Please try again.';

interface UseGuidoChatOptions {
  acceptsInput: (phase: ChatPhase) => boolean;
  onSubmit?: () => void;
  onResponse?: (content: string) => void;
}

const toRegistrySearchItem = (item: SearchResultItem): RegistrySearchItem => ({
  name: item.name,
  description: item.description || '',
  source: item.source,
  registryName: item.registryName,
  downloadUrl: item.downloadUrl,
});

export function useGuidoChat({ acceptsInput, onSubmit, onResponse }: UseGuidoChatOptions) {
  const {
    config,
    chatPhase: phase,
    setChatPhase: setPhase,
    setCurrentToolName,
    setChatResponse,
    addChatHistoryItem,
    sessionMessages,
    setSessionMessages,
  } = useAI();
  const [inputValue, setInputValue] = useState('');
  const { isListening, toggleListening } = useSpeechRecognition(setInputValue);
  const { handleFieldChange } = useFieldContext();
  const { template, fields, setFields, ruleSets, setRuleSets, selectedRuleSetIndex, updateTemplate } = useTemplateContext();
  const { searchAllRegistries, fetchPackageTemplates } = useRegistry();
  const { isExpertMode } = useAppContext();
  const registryResultsRef = useRef<SearchResultItem[]>([]);

  const send = useCallback(async () => {
    if (!inputValue.trim() || !acceptsInput(phase) || !config) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    onSubmit?.();
    setPhase('thinking');
    setChatResponse('');

    const availableTools = getToolsForMode(isExpertMode);
    const systemPrompt = getSystemPrompt(isExpertMode, {
      name: template.name,
      fileName: template.fileName,
      version: template.version,
      description: template.description,
      owner: template.owner,
      application: template.application,
      fieldCount: fields.length,
      ruleCount: ruleSets.reduce((acc, rs) => acc + rs.rules.length, 0),
    }, availableTools);
    const messages: ChatMessageWithTools[] = [
      { role: 'system', content: systemPrompt },
      ...sessionMessages,
      { role: 'user', content: userMessage },
    ];

    const toolContext: GuidoToolContext = {
      template: {
        name: template.name,
        fileName: template.fileName || '',
        version: template.version,
        description: template.description,
        owner: template.owner,
        application: template.application,
        docs: template.docs,
      },
      fields,
      setFields,
      handleFieldChange,
      ruleSets,
      setRuleSets,
      selectedRuleSetIndex,
      searchRegistries: async (query) => {
        registryResultsRef.current = await searchAllRegistries(query);
        return registryResultsRef.current.map(toRegistrySearchItem);
      },
      loadTemplateFromRegistry: async (packageName, source, version) => {
        try {
          const item = registryResultsRef.current.find(r => r.name === packageName && r.source === source);
          if (!item) {
            return { success: false, message: `Template "${packageName}" not found. Please search for it first using search_registries.` };
          }
          const templates = await fetchPackageTemplates(item, version);
          if (templates.length === 0) {
            return { success: false, message: 'No templates found in the package.' };
          }
          const templateToLoad = templates[0];
          updateTemplate(templateToLoad);
          return { success: true, message: `Successfully loaded template: ${templateToLoad.name}`, templateName: templateToLoad.name };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, message: `Failed to load template: ${errorMessage}` };
        }
      },
    };

    const toolsUsed: string[] = [];
    try {
      const turn = await runChatTurn(messages, {
        send: (history) => sendChatMessage(config.provider, config.apiKey, config.model, history, config.baseUrl, { tools: availableTools }),
        executeTool: async (toolCall) => (await executeToolCalls([toolCall], toolContext))[0],
        onToolCall: (toolName) => {
          setPhase('tool-calling');
          setCurrentToolName(toolName);
          toolsUsed.push(toolName);
        },
      });
      setCurrentToolName(null);
      setChatResponse(turn.content);
      setPhase('done');
      onResponse?.(turn.content);
      setSessionMessages(turn.messages.slice(1));
      addChatHistoryItem({ userMessage, assistantResponse: turn.content, toolsUsed: uniqueToolNames(toolsUsed) });
    } catch (error) {
      console.error('Chat error:', error);
      setChatResponse(CHAT_ERROR_MESSAGE);
      setPhase('done');
      addChatHistoryItem({ userMessage, assistantResponse: CHAT_ERROR_MESSAGE, toolsUsed: uniqueToolNames(toolsUsed) });
    }
  }, [inputValue, acceptsInput, phase, config, onSubmit, setPhase, setChatResponse, isExpertMode, template, fields, ruleSets, sessionMessages, setFields, handleFieldChange, setRuleSets, selectedRuleSetIndex, searchAllRegistries, fetchPackageTemplates, updateTemplate, setCurrentToolName, onResponse, setSessionMessages, addChatHistoryItem]);

  return { phase, inputValue, setInputValue, isListening, toggleListening, send };
}
