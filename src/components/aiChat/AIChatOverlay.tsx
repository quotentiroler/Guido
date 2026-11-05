import { useEffect, useRef, useCallback } from 'react'
import { Interweave } from 'interweave'
import { useAI } from '@/hooks/useAI'
import { useGuidoChat } from '@/hooks/ai/useGuidoChat'
import { type ChatPhase } from '@/context/AIContext'
import Portal from '@/components/shared/Portal'
import MicButton from './MicButton'
import SendIcon from './SendIcon'

const acceptsInput = (phase: ChatPhase) => phase === 'input'

export function AIChatOverlay() {
  const {
    isChatOpen: isOpen,
    setIsChatOpen,
    setChatPhase: setPhase,
    setCurrentToolName,
    setChatResponse,
    showFullResponse,
    setShowFullResponse,
    chatResponse: response,
    sessionMessages,
    clearSession,
  } = useAI()
  const inputRef = useRef<HTMLInputElement>(null)
  const { phase, inputValue, setInputValue, isListening, toggleListening, send } = useGuidoChat({ acceptsInput })

  const onClose = useCallback(() => {
    setIsChatOpen(false)
  }, [setIsChatOpen])

  useEffect(() => {
    if (isOpen && phase === 'input' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen, phase])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [send, onClose])

  const handleClose = useCallback(() => {
    setPhase('idle')
    setChatResponse('')
    setInputValue('')
    setCurrentToolName(null)
    setShowFullResponse(false)
    onClose()
  }, [onClose, setPhase, setCurrentToolName, setChatResponse, setInputValue, setShowFullResponse])

  const handleCloseFullResponse = useCallback(() => {
    setShowFullResponse(false)
  }, [setShowFullResponse])

  const handleNewChat = useCallback(() => {
    clearSession()
    setChatResponse('')
    setInputValue('')
    setPhase('input')
  }, [clearSession, setChatResponse, setInputValue, setPhase])

  if (!isOpen && !showFullResponse) return null

  const showModal = phase === 'input' || showFullResponse

  if (!showModal) return null

  const turnCount = Math.floor(sessionMessages.length / 2)

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[999] bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={showFullResponse ? handleCloseFullResponse : handleClose}
      />

      <div className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none p-4">
        {phase === 'input' && (
          <div className="pointer-events-auto animate-fade-in relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 rounded-2xl blur-sm opacity-50" />

            <div className="relative bg-surface-0 rounded-2xl p-4 border border-primary-300 dark:border-primary-500/30 shadow-2xl w-[380px]">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shadow-lg shadow-primary-500/50" />
                <span className="text-xs font-mono text-primary-600 dark:text-primary-400 uppercase tracking-wider">Guido AI</span>
                {sessionMessages.length > 0 && (
                  <span className="text-xs text-text-tertiary">
                    • {turnCount} turn{turnCount !== 1 ? 's' : ''}
                  </span>
                )}
                <div className="flex-1" />
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

                <MicButton variant="large" isListening={isListening} onClick={toggleListening} />

                <button
                  onClick={() => void send()}
                  disabled={!inputValue.trim()}
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 text-lg bg-primary-500 hover:bg-primary-600 text-gray-900 dark:text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105 disabled:opacity-30 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
                  title="Send"
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-3 text-xs text-text-tertiary text-center">
                Press Enter to send • Esc to close
              </div>
            </div>
          </div>
        )}

        {showFullResponse && response && (
          <div className="pointer-events-auto animate-fade-in relative max-w-lg">
            <div className="absolute -inset-1 bg-gradient-to-r from-success-400 via-primary-400 to-primary-500 rounded-2xl blur-sm opacity-40" />
            <div className="relative bg-surface-0 rounded-2xl p-5 border border-success-300 dark:border-success-500/30 shadow-2xl">
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

              <div className="markdown-content text-sm leading-relaxed text-text-primary max-h-[60vh] overflow-y-auto">
                <Interweave content={response} />
              </div>

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
