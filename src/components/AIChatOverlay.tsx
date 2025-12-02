import { useState, useRef, useEffect, useCallback } from 'react'
import { Interweave } from 'interweave'
import type { ChatMessageWithTools } from '../services/llmService'
import { sendChatMessage } from '../services/llmService'
import { executeToolCalls, getToolsForMode, getSystemPrompt, type GuidoToolContext, type RegistrySearchItem, type TemplateContext } from '../services/guidoTools'
import { useFieldContext } from '../hooks/useFieldContext'
import { useTemplateContext } from '../hooks/useTemplateContext'
import { useAI } from '../hooks/useAI'
import { useAppContext } from '../hooks/useAppContext'
import useRegistry, { SearchResultItem } from '../hooks/useRegistry'
import Portal from './shared/Portal'

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

export function AIChatOverlay() {
  const { 
    isChatOpen: isOpen, 
    setIsChatOpen, 
    config, 
    chatPhase: phase, 
    setChatPhase: setPhase, 
    setCurrentToolName,
    setChatResponse,
    showFullResponse,
    setShowFullResponse,
    chatResponse: response,
    addChatHistoryItem,
    sessionMessages,
    setSessionMessages,
    clearSession,
  } = useAI()
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  
  const { handleFieldChange } = useFieldContext()
  const { template, fields, setFields, ruleSets, setRuleSets, selectedRuleSetIndex, updateTemplate } = useTemplateContext()
  const { searchAllRegistries, fetchPackageTemplates, searchResults } = useRegistry()
  const { isExpertMode } = useAppContext()
  
  const onClose = useCallback(() => {
    setIsChatOpen(false)
  }, [setIsChatOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && phase === 'input' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen, phase])

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
    if (!inputValue.trim() || phase !== 'input' || !config) return

    const userMessage = inputValue.trim()
    setInputValue('')
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
        return new Promise((resolve) => {
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
          const item = searchResults.find((r: SearchResultItem) => r.name === packageName && r.source === source)
          if (!item) {
            return { success: false, message: `Template "${packageName}" not found. Please search for it first using search_registries.` }
          }
          
          const templates = await fetchPackageTemplates(item, version)
          if (templates.length === 0) {
            return { success: false, message: 'No templates found in the package.' }
          }
          
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
          
          // Add the final assistant response to working messages
          workingMessages.push({
            role: 'assistant',
            content: result.content,
          })
          
          // Update session messages with the new conversation turn (exclude system prompt)
          // Store: previous session + new user message + all assistant messages from this turn
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
  }, [inputValue, phase, config, template, fields, setFields, handleFieldChange, ruleSets, setRuleSets, selectedRuleSetIndex, setPhase, setCurrentToolName, setChatResponse, addChatHistoryItem, sessionMessages, setSessionMessages, searchAllRegistries, searchResults, fetchPackageTemplates, updateTemplate, isExpertMode])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [handleSend, onClose])

  const handleClose = useCallback(() => {
    setPhase('idle')
    setChatResponse('')
    setInputValue('')
    setCurrentToolName(null)
    setShowFullResponse(false)
    onClose()
    // Note: We don't clear session here - session persists until user starts a new chat
  }, [onClose, setPhase, setCurrentToolName, setChatResponse, setShowFullResponse])

  // Close just the full response modal, but keep the response on Guido's bubble
  const handleCloseFullResponse = useCallback(() => {
    setShowFullResponse(false)
  }, [setShowFullResponse])

  const handleNewChat = useCallback(() => {
    clearSession()
    setChatResponse('')
    setInputValue('')
    setPhase('input')
  }, [clearSession, setChatResponse, setPhase])

  // Show overlay if chat is open OR if we need to show the full response
  if (!isOpen && !showFullResponse) return null

  // Only show the modal overlay for input phase or when "See more" is clicked for full response
  // Thinking/tool-calling/done phases are shown as bubbles on Guido, not here
  const showModal = phase === 'input' || showFullResponse

  if (!showModal) return null

  return (
    <Portal>
      {/* Backdrop for clicking outside to close */}
      <div 
        className="fixed inset-0 z-[999] bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={showFullResponse ? handleCloseFullResponse : handleClose}
      />
      
      {/* Centered modal container */}
      <div className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none p-4">
        {/* Input phase - themed input modal */}
        {phase === 'input' && (
          <div className="pointer-events-auto animate-fade-in relative">
            {/* Outer glow ring */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 rounded-2xl blur-sm opacity-50" />
            
            {/* Main container */}
            <div className="relative bg-surface-0 rounded-2xl p-4 border border-primary-300 dark:border-primary-500/30 shadow-2xl w-[380px]">
              {/* Header with AI indicator */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shadow-lg shadow-primary-500/50" />
                <span className="text-xs font-mono text-primary-600 dark:text-primary-400 uppercase tracking-wider">Guido AI</span>
                {/* Session indicator */}
                {sessionMessages.length > 0 && (
                  <span className="text-xs text-text-tertiary">
                    • {Math.floor(sessionMessages.length / 2)} turn{Math.floor(sessionMessages.length / 2) !== 1 ? 's' : ''}
                  </span>
                )}
                <div className="flex-1" />
                {/* New Chat button - only show if there's an active session */}
                {sessionMessages.length > 0 && (
                  <button 
                    onClick={handleNewChat}
                    className="text-xs text-text-tertiary hover:text-primary-500 transition-colors mr-2"
                    title="Start a new conversation"
                  >
                    New Chat
                  </button>
                )}
                <button 
                  onClick={handleClose}
                  className="w-6 h-6 flex items-center justify-center text-text-secondary hover:text-primary-500 transition-colors rounded-lg hover:bg-surface-2"
                >
                  ✕
                </button>
              </div>
              
              {/* Input area */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything..."
                    className="w-full bg-surface-1 border border-strong rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                  />
                </div>
                
                {/* Mic button */}
                <button
                  onClick={toggleListening}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 text-lg
                    ${isListening 
                      ? 'bg-danger-100 dark:bg-danger-900/30 border-2 border-danger-500 text-danger-500 shadow-lg shadow-danger-500/30 animate-pulse' 
                      : 'bg-surface-1 border border-strong text-text-secondary hover:border-primary-500 hover:text-primary-500 hover:shadow-lg hover:shadow-primary-500/20'
                    }`}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  🎤
                </button>
                
                {/* Send button */}
                <button
                  onClick={() => void handleSend()}
                  disabled={!inputValue.trim()}
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 text-lg bg-primary-500 hover:bg-primary-600 text-gray-900 dark:text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105 disabled:opacity-30 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
                  title="Send"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              
              {/* Hint text */}
              <div className="mt-3 text-xs text-text-tertiary text-center">
                Press Enter to send • Esc to close
              </div>
            </div>
          </div>
        )}

        {/* Thinking and tool-calling phases are shown as bubbles on Guido mascot, not here */}

        {/* Full Response overlay - shown when "See more" is clicked */}
        {showFullResponse && response && (
          <div className="pointer-events-auto animate-fade-in relative max-w-lg">
            <div className="absolute -inset-1 bg-gradient-to-r from-success-400 via-primary-400 to-primary-500 rounded-2xl blur-sm opacity-40" />
            <div className="relative bg-surface-0 rounded-2xl p-5 border border-success-300 dark:border-success-500/30 shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-success-500 shadow-lg shadow-success-500/50" />
                <span className="text-xs font-mono text-success-600 dark:text-success-400 uppercase tracking-wider">Guido says</span>
                <div className="flex-1" />
                <button 
                  onClick={handleCloseFullResponse}
                  className="w-6 h-6 flex items-center justify-center text-text-secondary hover:text-success-500 transition-colors rounded-lg hover:bg-surface-2"
                >
                  ✕
                </button>
              </div>
              
              {/* Response text */}
              <div className="markdown-content text-sm leading-relaxed text-text-primary max-h-[60vh] overflow-y-auto">
                <Interweave content={response} />
              </div>
              
              {/* Close hint */}
              <div className="mt-4 text-xs text-text-tertiary text-center">
                Click anywhere or press Esc to close
              </div>
            </div>
          </div>
        )}
      </div>
    </Portal>
  )
}

export default AIChatOverlay
