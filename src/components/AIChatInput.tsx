import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessageWithTools } from '../services/llmService'
import { sendChatMessage } from '../services/llmService'
import { executeToolCalls, getToolsForMode, getSystemPrompt, type GuidoToolContext, type RegistrySearchItem, type TemplateContext } from '../services/guidoTools'
import { useFieldContext } from '../hooks/useFieldContext'
import { useTemplateContext } from '../hooks/useTemplateContext'
import { useAI } from '../hooks/useAI'
import { useAppContext } from '../hooks/useAppContext'
import useRegistry, { SearchResultItem } from '../hooks/useRegistry'

// Speech recognition types for TypeScript
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative
  isFinal: boolean
  length: number
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: Event) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

export function AIChatInput() {
  const { 
    config, 
    chatPhase: phase, 
    setChatPhase: setPhase, 
    setCurrentToolName,
    setChatResponse,
    addChatHistoryItem,
    sessionMessages,
    setSessionMessages,
    speakResponse,
    cancelSpeech,
    speechEnabled,
    setSpeechEnabled,
    isSpeaking,
    speechRate,
    setSpeechRate,
    speechVolume,
    setSpeechVolume,
  } = useAI()
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [showSpeechSettings, setShowSpeechSettings] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const speechHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const { handleFieldChange } = useFieldContext()
  const { template, fields, setFields, ruleSets, setRuleSets, selectedRuleSetIndex, updateTemplate } = useTemplateContext()
  const { searchAllRegistries, fetchPackageTemplates, searchResults } = useRegistry()
  const { isExpertMode } = useAppContext()

  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i])
          .map(result => result[0].transcript)
          .join('')
        setInputValue(transcript)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current.onerror = () => {
        setIsListening(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || (phase !== 'idle' && phase !== 'done') || !config) return

    const userMessage = inputValue.trim()
    setInputValue('')
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setPhase('thinking')
    setChatResponse('')

    // Build template context for the system prompt
    const templateContext: TemplateContext = {
      name: template.name,
      fileName: template.fileName,
      version: template.version,
      description: template.description,
      owner: template.owner,
      application: template.application,
      fieldCount: fields.length,
      ruleCount: ruleSets.reduce((acc, rs) => acc + rs.rules.length, 0),
    }

    // Get tools available for current mode (simple mode filters out expert-only tools)
    const availableTools = getToolsForMode(isExpertMode)

    // Build messages array - include session history for context
    const messages: ChatMessageWithTools[] = [
      { role: 'system', content: getSystemPrompt(isExpertMode, templateContext, availableTools) },
      ...sessionMessages, // Include previous conversation turns
      { role: 'user', content: userMessage }
    ]

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
      // Registry functions for AI tools
      searchRegistries: async (query: string): Promise<RegistrySearchItem[]> => {
        await searchAllRegistries(query)
        // searchAllRegistries updates searchResults state, so we need to return a promise that resolves with the results
        // Since searchAllRegistries is async and updates state, we'll search and return the results
        return new Promise((resolve) => {
          // Small delay to allow state to update, then return current results
          setTimeout(() => {
            resolve(searchResults.map((item: SearchResultItem) => ({
              name: item.name,
              description: item.description || '',
              source: item.source,
              registryName: item.registryName,
              downloadUrl: item.downloadUrl,
            })))
          }, 500)
        })
      },
      loadTemplateFromRegistry: async (packageName: string, source: string, version?: string) => {
        try {
          // Find the item in search results
          const item = searchResults.find((r: SearchResultItem) => r.name === packageName && r.source === source)
          if (!item) {
            return { success: false, message: `Template "${packageName}" not found. Please search for it first using search_registries.` }
          }
          
          const templates = await fetchPackageTemplates(item, version)
          if (templates.length === 0) {
            return { success: false, message: 'No templates found in the package.' }
          }
          
          // Load the first template (or could prompt user to choose if multiple)
          const templateToLoad = templates[0]
          updateTemplate(templateToLoad)
          
          return { 
            success: true, 
            message: `Successfully loaded template: ${templateToLoad.name}`,
            templateName: templateToLoad.name 
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          return { success: false, message: `Failed to load template: ${errorMessage}` }
        }
      },
    }

    // Track tools used during this conversation turn
    const toolsUsed: string[] = [];

    try {
      let continueLoop = true
      // Work with a copy that we'll update during the loop
      const workingMessages = [...messages]
      
      while (continueLoop) {
        const result = await sendChatMessage(
          config.provider,
          config.apiKey,
          config.model,
          workingMessages,
          config.baseUrl,
          { tools: availableTools }
        )

        if (result.toolCalls && result.toolCalls.length > 0) {
          // Add assistant message with tool calls
          workingMessages.push({
            role: 'assistant',
            content: result.content,
            toolCalls: result.toolCalls,
          })

          // Execute tools one by one with visual feedback
          const toolResults = []
          for (const toolCall of result.toolCalls) {
            // Show which tool is being called
            setPhase('tool-calling')
            setCurrentToolName(toolCall.name)
            toolsUsed.push(toolCall.name)
            
            // Small delay to ensure UI updates and shows the tool name
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const [toolResult] = await executeToolCalls([toolCall], toolContext)
            toolResults.push(toolResult)
          }

          // Add tool results to the last assistant message
          const lastMessage = workingMessages[workingMessages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.toolResults = toolResults
          }

          // Keep showing last tool until we get the next response
          // (avoids flashing "Thinking..." between tool calls)
          // Continue loop to get final response
        } else {
          // No more tool calls, we have the final response
          continueLoop = false
          setCurrentToolName(null)
          setChatResponse(result.content)
          setPhase('done')
          
          // Speak the response (if speech is enabled)
          speakResponse(result.content)
          
          // Add the final assistant response to working messages
          workingMessages.push({
            role: 'assistant',
            content: result.content,
          })
          
          // Update session messages with the new conversation turn (exclude system prompt)
          const newSessionMessages = workingMessages.slice(1) // Remove system prompt
          setSessionMessages(newSessionMessages)
          
          // Save to chat history
          addChatHistoryItem({
            userMessage,
            assistantResponse: result.content,
            toolsUsed: toolsUsed.length > 0 ? [...new Set(toolsUsed)] : undefined,
          })
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = 'Sorry, something went wrong. Please try again.'
      setChatResponse(errorMessage)
      setPhase('done')
      
      // Still save the failed attempt to history
      addChatHistoryItem({
        userMessage,
        assistantResponse: errorMessage,
        toolsUsed: toolsUsed.length > 0 ? [...new Set(toolsUsed)] : undefined,
      })
    }
  }, [inputValue, phase, config, template, fields, setFields, handleFieldChange, ruleSets, setRuleSets, selectedRuleSetIndex, setPhase, setCurrentToolName, setChatResponse, addChatHistoryItem, sessionMessages, setSessionMessages, searchAllRegistries, searchResults, fetchPackageTemplates, updateTemplate, isExpertMode, speakResponse])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  const isProcessing = phase === 'thinking' || phase === 'tool-calling'
  const canSend = inputValue.trim() && !isProcessing

  return (
    <div className="space-y-2">
      {/* Input row */}
      <div className="flex items-start gap-2">
        
        {/* Input field */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              // Auto-resize
              e.target.style.height = 'auto'
              const newHeight = Math.min(e.target.scrollHeight, 150)
              e.target.style.height = `${newHeight}px`
              // Only show scrollbar when at max height
              e.target.style.overflowY = e.target.scrollHeight > 150 ? 'auto' : 'hidden'
            }}
            onKeyDown={handleKeyDown}
            placeholder={isProcessing ? "Thinking..." : "Ask Guido anything..."}
            disabled={isProcessing}
            rows={1}
            className="w-full bg-surface-1 border border-strong rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden"
            style={{ maxHeight: '150px' }}
          />
        </div>
        
        {/* Mic button */}
        <button
          onClick={toggleListening}
          disabled={isProcessing}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm
            ${isListening 
              ? 'bg-danger-100 dark:bg-danger-900/30 border border-danger-500 text-danger-500 animate-pulse' 
              : 'bg-surface-1 border border-strong text-text-secondary hover:border-primary-500 hover:text-primary-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          🎤
        </button>

        {/* Speech toggle button with settings popover */}
        <div 
          className="relative"
          onMouseEnter={() => {
            if (speechHoverTimeoutRef.current) {
              clearTimeout(speechHoverTimeoutRef.current)
            }
            speechHoverTimeoutRef.current = setTimeout(() => {
              setShowSpeechSettings(true)
            }, 600)
          }}
          onMouseLeave={() => {
            if (speechHoverTimeoutRef.current) {
              clearTimeout(speechHoverTimeoutRef.current)
              speechHoverTimeoutRef.current = null
            }
            // Delay hiding to allow moving to popover
            speechHoverTimeoutRef.current = setTimeout(() => {
              setShowSpeechSettings(false)
            }, 300)
          }}
        >
          <button
            onClick={() => {
              if (isSpeaking) {
                cancelSpeech()
              } else {
                setSpeechEnabled(!speechEnabled)
              }
            }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm
              ${isSpeaking 
                ? 'bg-primary-500 text-white animate-pulse' 
                : speechEnabled 
                  ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-500 text-primary-500' 
                  : 'bg-surface-1 border border-strong text-text-tertiary hover:border-primary-500 hover:text-primary-500'
              }`}
            title={isSpeaking ? 'Stop speaking' : speechEnabled ? 'Disable voice output' : 'Enable voice output'}
          >
            {isSpeaking ? '🔊' : speechEnabled ? '🔊' : '🔇'}
          </button>
          
          {/* Speech settings popover */}
          {showSpeechSettings && (
            <div className="absolute bottom-full right-0 mb-2 p-3 bg-surface-1 border border-strong rounded-lg shadow-lg min-w-[200px] z-50">
              <div className="text-xs font-medium text-text-secondary mb-3">Voice Settings</div>
              
              {/* Note when speaking */}
              {isSpeaking && (
                <div className="text-xs text-text-tertiary mb-3 italic">
                  Changes apply to next response
                </div>
              )}
              
              {/* Speed slider */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-text-tertiary mb-1">
                  <span>Speed</span>
                  <span>{speechRate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>
              
              {/* Volume slider */}
              <div>
                <div className="flex justify-between text-xs text-text-tertiary mb-1">
                  <span>Volume</span>
                  <span>{Math.round(speechVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={speechVolume}
                  onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Send button */}
        <button
          onClick={() => void handleSend()}
          disabled={!canSend}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-md disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed"
          title="Send"
        >
          <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default AIChatInput
