import { useState, useRef, useCallback } from 'react'
import { useAI } from '@/hooks/useAI'
import { useGuidoChat } from '@/hooks/ai/useGuidoChat'
import { type ChatPhase } from '@/context/AIContext'
import MicButton from './MicButton'
import SendIcon from './SendIcon'

const MAX_TEXTAREA_HEIGHT = 150

const acceptsInput = (phase: ChatPhase) => phase === 'idle' || phase === 'done'

export function AIChatInput() {
  const {
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
  const [showSpeechSettings, setShowSpeechSettings] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const speechHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }, [])

  const { phase, inputValue, setInputValue, isListening, toggleListening, send } = useGuidoChat({
    acceptsInput,
    onSubmit: resetTextareaHeight,
    onResponse: speakResponse,
  })

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }, [send])

  const scheduleSpeechSettings = (show: boolean, delayMs: number) => {
    if (speechHoverTimeoutRef.current) {
      clearTimeout(speechHoverTimeoutRef.current)
    }
    speechHoverTimeoutRef.current = setTimeout(() => setShowSpeechSettings(show), delayMs)
  }

  const isProcessing = phase === 'thinking' || phase === 'tool-calling'
  const canSend = inputValue.trim() && !isProcessing

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
              e.target.style.overflowY = e.target.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
            }}
            onKeyDown={handleKeyDown}
            placeholder={isProcessing ? "Thinking..." : "Ask Guido anything..."}
            disabled={isProcessing}
            rows={1}
            className="w-full bg-surface-1 border border-strong rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden"
            style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
          />
        </div>

        <MicButton variant="compact" isListening={isListening} onClick={toggleListening} disabled={isProcessing} />

        <div
          className="relative"
          onMouseEnter={() => scheduleSpeechSettings(true, 600)}
          onMouseLeave={() => scheduleSpeechSettings(false, 300)}
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
            {isSpeaking || speechEnabled ? '🔊' : '🔇'}
          </button>

          {showSpeechSettings && (
            <div className="absolute bottom-full right-0 mb-2 p-3 bg-surface-1 border border-strong rounded-lg shadow-lg min-w-[200px] z-50">
              <div className="text-xs font-medium text-text-secondary mb-3">Voice Settings</div>

              {isSpeaking && (
                <div className="text-xs text-text-tertiary mb-3 italic">
                  Changes apply to next response
                </div>
              )}

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

        <button
          onClick={() => void send()}
          disabled={!canSend}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-md disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed"
          title="Send"
        >
          <SendIcon className="w-4 h-4 rotate-90" />
        </button>
      </div>
    </div>
  )
}

export default AIChatInput
