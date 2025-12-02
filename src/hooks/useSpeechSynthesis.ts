import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface Voice {
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
  voiceURI: string;
}

export interface SpeechSynthesisOptions {
  /** Speech rate (0.1 - 10, default 0.85 for robotic effect) */
  rate?: number;
  /** Pitch (0 - 2, default 0.7 for robotic effect) */
  pitch?: number;
  /** Volume (0 - 1, default 1) */
  volume?: number;
  /** Preferred voice name or language */
  voiceName?: string;
  /** Preferred language (e.g., 'en-US') */
  lang?: string;
}

export interface UseSpeechSynthesisReturn {
  /** Whether speech synthesis is supported in this browser */
  isSupported: boolean;
  /** Whether Guido is currently speaking */
  isSpeaking: boolean;
  /** Whether speech is paused */
  isPaused: boolean;
  /** Whether speech output is enabled */
  isEnabled: boolean;
  /** Toggle speech output on/off */
  setEnabled: (enabled: boolean) => void;
  /** Available voices */
  voices: Voice[];
  /** Currently selected voice */
  selectedVoice: Voice | null;
  /** Set the voice to use */
  setVoice: (voice: Voice) => void;
  /** Speak the given text */
  speak: (text: string, options?: SpeechSynthesisOptions) => void;
  /** Speak the given text and return Promise that resolves when done */
  speakAsync: (text: string, options?: SpeechSynthesisOptions) => Promise<void>;
  /** Cancel current speech */
  cancel: () => void;
  /** Pause current speech */
  pause: () => void;
  /** Resume paused speech */
  resume: () => void;
  /** Current speech options */
  options: SpeechSynthesisOptions;
  /** Update speech options */
  setOptions: (options: SpeechSynthesisOptions) => void;
}

// Default options for robotic Guido voice
const DEFAULT_OPTIONS: SpeechSynthesisOptions = {
  rate: 1.1,       // Slightly faster for robotic feel
  pitch: 0.4,      // Much lower pitch for robotic/masculine effect
  volume: 1,
  lang: 'en-US',
};

/**
 * Hook for speech synthesis - makes Guido speak responses
 * Uses the native Web Speech API for browser-based TTS
 */
export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  // Check browser support synchronously during initialization
  const [isSupported] = useState(() => 
    typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [options, setOptions] = useState<SpeechSynthesisOptions>(DEFAULT_OPTIONS);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load voices when supported
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      const mappedVoices: Voice[] = availableVoices.map(v => ({
        name: v.name,
        lang: v.lang,
        default: v.default,
        localService: v.localService,
        voiceURI: v.voiceURI,
      }));
      
      setVoices(mappedVoices);
      
      // Auto-select a good English voice for Guido - prefer male/robotic sounding
      if (mappedVoices.length > 0 && !selectedVoice) {
        // Prefer male voices or those with robotic-sounding names
        const maleVoice = mappedVoices.find(v => 
          v.lang.startsWith('en') && (
            v.name.toLowerCase().includes('male') ||
            v.name.toLowerCase().includes('david') ||
            v.name.toLowerCase().includes('james') ||
            v.name.toLowerCase().includes('daniel') ||
            v.name.toLowerCase().includes('george') ||
            v.name.toLowerCase().includes('guy')
          )
        );
        const googleMaleVoice = mappedVoices.find(v => 
          v.name.toLowerCase().includes('google') && 
          v.lang.startsWith('en') &&
          v.name.toLowerCase().includes('us')
        );
        const googleVoice = mappedVoices.find(v => 
          v.name.toLowerCase().includes('google') && v.lang.startsWith('en')
        );
        const englishVoice = mappedVoices.find(v => v.lang.startsWith('en'));
        const defaultVoice = mappedVoices.find(v => v.default);
        
        setSelectedVoice(maleVoice || googleMaleVoice || googleVoice || englishVoice || defaultVoice || mappedVoices[0]);
      }
    };

    // Load voices immediately if available
    loadVoices();
    
    // Also listen for voiceschanged event (Chrome loads voices async)
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [isSupported, selectedVoice]);

  // Track previous values to avoid unnecessary state updates
  const prevSpeakingRef = useRef(false);
  const prevPausedRef = useRef(false);

  // Update speaking state based on speechSynthesis
  useEffect(() => {
    if (!isSupported) return;
    
    const checkSpeaking = () => {
      const speaking = speechSynthesis.speaking;
      const paused = speechSynthesis.paused;
      
      // Only update state if values actually changed
      if (speaking !== prevSpeakingRef.current) {
        prevSpeakingRef.current = speaking;
        setIsSpeaking(speaking);
      }
      if (paused !== prevPausedRef.current) {
        prevPausedRef.current = paused;
        setIsPaused(paused);
      }
    };
    
    const interval = setInterval(checkSpeaking, 100);
    return () => clearInterval(interval);
  }, [isSupported]);

  const speak = useCallback((text: string, overrideOptions?: SpeechSynthesisOptions) => {
    if (!isSupported || !isEnabled || !text.trim()) return;
    
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply robotic voice settings directly - don't rely on state
    utterance.rate = overrideOptions?.rate ?? 1.0;     // Normal speed
    utterance.pitch = overrideOptions?.pitch ?? 0.3;   // Very low pitch for robotic
    utterance.volume = overrideOptions?.volume ?? 1;
    utterance.lang = overrideOptions?.lang ?? 'en-US';
    
    // Find and set a male/robotic voice directly
    const availableVoices = speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      // Priority: Microsoft David > Microsoft Mark > Google US > any male-sounding > any English
      const preferredVoice = 
        availableVoices.find(v => v.name.includes('David')) ||
        availableVoices.find(v => v.name.includes('Mark')) ||
        availableVoices.find(v => v.name.includes('Male') && v.lang.startsWith('en')) ||
        availableVoices.find(v => v.name.toLowerCase().includes('google') && v.lang === 'en-US') ||
        availableVoices.find(v => v.lang.startsWith('en'));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }
    
    // Event handlers
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      // Don't log "interrupted" or "canceled" errors - these are expected when starting new speech
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.error('Speech synthesis error:', e);
      }
      setIsSpeaking(false);
    };
    utterance.onpause = () => setIsPaused(true);
    utterance.onresume = () => setIsPaused(false);
    
    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [isSupported, isEnabled]);

  // Async version that returns a Promise resolving when speech finishes
  const speakAsync = useCallback((text: string, overrideOptions?: SpeechSynthesisOptions): Promise<void> => {
    return new Promise((resolve) => {
      if (!isSupported || !isEnabled || !text.trim()) {
        resolve();
        return;
      }
      
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply robotic voice settings
      utterance.rate = overrideOptions?.rate ?? 1.0;
      utterance.pitch = overrideOptions?.pitch ?? 0.3;
      utterance.volume = overrideOptions?.volume ?? 1;
      utterance.lang = overrideOptions?.lang ?? 'en-US';
      
      // Find and set a preferred voice
      const availableVoices = speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        const preferredVoice = 
          availableVoices.find(v => v.name.includes('David')) ||
          availableVoices.find(v => v.name.includes('Mark')) ||
          availableVoices.find(v => v.name.includes('Male') && v.lang.startsWith('en')) ||
          availableVoices.find(v => v.name.toLowerCase().includes('google') && v.lang === 'en-US') ||
          availableVoices.find(v => v.lang.startsWith('en'));
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }
      
      // Event handlers
      utterance.onstart = () => {
        prevSpeakingRef.current = true;
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        prevSpeakingRef.current = false;
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.error('Speech synthesis error:', e);
        }
        prevSpeakingRef.current = false;
        setIsSpeaking(false);
        resolve(); // Resolve even on error to not block animation
      };
      
      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    });
  }, [isSupported, isEnabled]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported]);

  const setVoice = useCallback((voice: Voice) => {
    setSelectedVoice(voice);
  }, []);

  // Memoize return value to prevent unnecessary re-renders in consumers
  return useMemo(() => ({
    isSupported,
    isSpeaking,
    isPaused,
    isEnabled,
    setEnabled: setIsEnabled,
    voices,
    selectedVoice,
    setVoice,
    speak,
    speakAsync,
    cancel,
    pause,
    resume,
    options,
    setOptions,
  }), [
    isSupported,
    isSpeaking,
    isPaused,
    isEnabled,
    voices,
    selectedVoice,
    setVoice,
    speak,
    speakAsync,
    cancel,
    pause,
    resume,
    options,
  ]);
}

export default useSpeechSynthesis;
