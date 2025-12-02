import React, { useState, useEffect } from "react";
import guidoImage from "@/assets/guido.png";
import { useAI } from "@/hooks/useAI";
import AISetupModal from "./AISetupModal";

// Different emotes Guido can do
const emotes = [
  { name: "wave", animation: "animate-wave" },
  { name: "bounce", animation: "animate-bounce" },
  { name: "wiggle", animation: "animate-wiggle" },
  { name: "spin", animation: "animate-spin-slow" },
  { name: "pulse", animation: "animate-pulse" },
];

interface GuidoMascotProps {
  onToggleChat?: () => void;
}

const GuidoMascot: React.FC<GuidoMascotProps> = ({ onToggleChat }) => {
  const [currentEmote, setCurrentEmote] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const { isConfigured, chatPhase, currentToolName, chatResponse, setShowFullResponse, setChatPhase, setChatResponse, speakResponse, isSpeaking, speechEnabled } = useAI();

  // Random emote every 30 seconds
  useEffect(() => {
    const doEmote = () => {
      const randomEmote = emotes[Math.floor(Math.random() * emotes.length)];
      setCurrentEmote(randomEmote.animation);
      
      // Clear emote after animation completes (1 second)
      setTimeout(() => {
        setCurrentEmote(null);
      }, 1000);
    };

    // Initial emote after a short delay
    const initialTimer = setTimeout(doEmote, 2000);
    
    // Then every 30 seconds
    const interval = setInterval(doEmote, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  // Emote on hover
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (!currentEmote) {
      setCurrentEmote("animate-wiggle");
      setTimeout(() => {
        if (!isHovered) setCurrentEmote(null);
      }, 500);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Handle click - open setup modal if not configured, toggle chat if configured
  const handleClick = () => {
    if (!isConfigured) {
      setShowSetupModal(true);
    } else if (onToggleChat) {
      onToggleChat();
    }
  };

  // Mascot is clickable when AI is not configured (to open setup) or when onToggleChat is provided
  const isClickable = !isConfigured || !!onToggleChat;

  // Check if we're in a thinking/tool-calling state
  const isThinking = chatPhase === 'thinking';
  const isToolCalling = chatPhase === 'tool-calling';
  const showThinkingBubble = isThinking || isToolCalling;
  const showResponseBubble = chatPhase === 'done' && chatResponse;

  // Truncate response for bubble preview
  const maxPreviewLength = 80;
  const truncatedResponse = chatResponse && chatResponse.length > maxPreviewLength 
    ? chatResponse.substring(0, maxPreviewLength) + '...' 
    : chatResponse;
  const needsSeeMore = chatResponse && chatResponse.length > maxPreviewLength;

  // Handle "See more" click
  const handleSeeMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFullResponse(true);
  };

  // Handle speech bubble click - only open full response, never stop speech
  const handleSpeechBubbleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Always open full response
    setShowFullResponse(true);
    // Also speak if speech is enabled and not already speaking
    if (speechEnabled && chatResponse && !isSpeaking) {
      speakResponse(chatResponse);
    }
  };

  // Handle dismiss response bubble
  const handleDismissResponse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setChatPhase('idle');
    setChatResponse('');
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative transition-transform duration-300 ${isHovered && !showResponseBubble ? "scale-105" : ""} ${isClickable ? "cursor-pointer" : "cursor-default"}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <img
          src={guidoImage}
          alt="Guido"
          className={`w-24 h-24 sm:w-32 sm:h-32 object-contain drop-shadow-lg ${currentEmote || ""}`}
        />
        
        {/* Thinking/Tool-calling bubble - shows when processing (positioned to the right of Guido) */}
        {showThinkingBubble && (
          <div className="absolute -top-2 left-full ml-2 sm:-top-4 sm:left-auto sm:-right-32 animate-fade-in z-50">
            {/* Cloud-like thought bubble */}
            <div className="relative bg-surface-1 border-2 border-primary-400 rounded-full px-4 py-2 sm:px-5 sm:py-2.5 shadow-xl shadow-primary-500/30">
              <div className="flex items-center gap-2">
                {isThinking ? (
                  <>
                    {/* Spinning indicator */}
                    <div className="relative w-4 h-4">
                      <div className="absolute inset-0 rounded-full border-2 border-primary-300 border-t-primary-500 animate-spin" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-primary-600 dark:text-primary-400 whitespace-nowrap">
                      Thinking...
                    </span>
                  </>
                ) : (
                  <>
                    {/* Tool icon */}
                    <span className="text-sm sm:text-base">🔧</span>
                    <span className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap max-w-[100px] sm:max-w-none truncate">
                      {currentToolName?.replace(/_/g, ' ') || 'Working...'}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* Thought bubble circles (cloud trail) - hidden on mobile for cleaner look */}
            <div className="hidden sm:block absolute -bottom-2 -left-2">
              <div className="w-4 h-4 rounded-full bg-surface-1 border-2 border-primary-400 shadow-md" />
            </div>
            <div className="hidden sm:block absolute -bottom-4 -left-5">
              <div className="w-2.5 h-2.5 rounded-full bg-surface-1 border-2 border-primary-400 shadow-sm animate-pulse" />
            </div>
            <div className="hidden sm:block absolute -bottom-5 -left-7">
              <div className="w-1.5 h-1.5 rounded-full bg-surface-1 border border-primary-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            </div>
          </div>
        )}

        {/* Response speech bubble - shows when AI has responded */}
        {showResponseBubble && (
          <div className="absolute -top-2 left-full ml-2 sm:-top-4 sm:left-auto sm:-right-44 animate-fade-in z-50 w-36 sm:w-48">
            {/* Speech bubble - clickable to speak or show full response */}
            <div 
              className={`relative bg-surface-1 border-2 rounded-2xl px-3 py-2 shadow-xl cursor-pointer transition-colors ${
                isSpeaking 
                  ? 'border-primary-500 shadow-primary-500/30 animate-pulse' 
                  : 'border-success-400 shadow-success-500/20 hover:border-success-500'
              }`}
              onClick={handleSpeechBubbleClick}
              title={isSpeaking ? 'Click to stop speaking' : speechEnabled ? 'Click to hear response' : 'Click to see full response'}
            >
              {/* Close button */}
              <button
                onClick={handleDismissResponse}
                className="absolute -top-2 -right-2 w-5 h-5 bg-surface-1 border border-strong rounded-full flex items-center justify-center text-xs text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors shadow-md z-10"
              >
                ✕
              </button>

              {/* Speaker icon when speaking */}
              {isSpeaking && (
                <div className="absolute -top-2 -left-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs shadow-md z-10 animate-pulse">
                  🔊
                </div>
              )}
              
              {/* Response text */}
              <p className="text-xs text-text-primary leading-relaxed">
                {truncatedResponse}
              </p>
              
              {/* See more button */}
              {needsSeeMore && (
                <button
                  onClick={handleSeeMore}
                  className="mt-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                >
                  See more...
                </button>
              )}
            </div>
            
            {/* Speech bubble tail - pointing to Guido - hidden on mobile */}
            <div className="hidden sm:block absolute bottom-2 -left-2">
              <div className={`w-3 h-3 bg-surface-1 border-l-2 border-b-2 rotate-45 ${isSpeaking ? 'border-primary-500' : 'border-success-400'}`} />
            </div>
          </div>
        )}
        
        {/* Speech bubble on hover - only show if not configured (to prompt setup) */}
        {isHovered && !isConfigured && !showThinkingBubble && !showResponseBubble && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-1 border border-strong rounded-lg px-3 py-1 text-sm text-text-primary whitespace-nowrap shadow-lg animate-fade-in">
            Click to set up AI! 🤖
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-surface-1" />
          </div>
        )}
      </div>
      
      {/* Text below Guido - only show setup prompt when not configured */}
      {!isConfigured && (
        <p className="text-base sm:text-lg text-text-secondary mt-2 text-center">
          Click me to set up AI!
        </p>
      )}

      {/* AI Setup Modal */}
      {showSetupModal && (
        <AISetupModal onClose={() => setShowSetupModal(false)} />
      )}
    </div>
  );
};

export default GuidoMascot;
