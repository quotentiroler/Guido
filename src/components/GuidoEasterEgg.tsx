import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useEasterEgg } from "@/hooks/useEasterEgg";
import { useAI } from "@/hooks/useAI";
import SpaceStars from "@/components/shared/SpaceStars";
import MarsCliffBackground from "@/components/MarsCliffBackground";
import OlympusMons from "@/components/shared/OlympusMons";

interface GuidoEasterEggProps {
  isActive: boolean;
  onComplete: () => void;
}

interface DialogueLine {
  text: string;
  duration: number;
  position?: "left" | "center" | "right" | "cliff-edge" | "offscreen-right" | "descend";
  action?: "roll" | "stop" | "secret" | "wave" | "exit";
  background?: "mars" | "journey" | "cliff";
}

interface DustParticle {
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
}

// Pre-generate dust particles outside render
const generateDustParticles = (count: number): DustParticle[] => {
  return Array.from({ length: count }, () => ({
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 2,
  }));
};

const GUIDO_STORY: DialogueLine[] = [
  { text: "Oh! A visitor! 👋", duration: 2000, position: "left", action: "stop" },
  { text: "Hey there! I'm Guido!", duration: 2000, position: "left" },
  { text: "You know Sojourner? Mars Pathfinder, 1997?", duration: 2500, position: "left" },
  { text: "Cute little rover. We were roommates! 🤖", duration: 2500, position: "left", action: "roll" },
  { text: "Well... until I borrowed her antenna.", duration: 2500, position: "center", action: "stop" },
  { text: "And maybe her solar panel. Just a little one!", duration: 2500, position: "center" },
  { text: "She didn't need ALL of them, right? 😅", duration: 2500, position: "center" },
  { text: "Anyway! Wanna see something cool?", duration: 2000, position: "center", action: "roll", background: "journey" },
  { text: "*rolling across Mars like a boss* 🛞", duration: 2500, position: "right" },
  { text: "Check it out! Olympus Mons! 🌋", duration: 2500, position: "right" },
  { text: "I've got a secret spot nearby...", duration: 2500, position: "right", action: "stop" },
  { text: "Welcome to my chill zone! 🌅", duration: 2500, position: "cliff-edge", action: "secret", background: "cliff" },
  { text: "The Valles Marineris. Best view on Mars!", duration: 3000, position: "cliff-edge" },
  { text: "I keep all my favorite configs down there.", duration: 2500, position: "cliff-edge" },
  { text: "27 years of collecting! 📁", duration: 2500, position: "cliff-edge", action: "wave" },
  { text: "Stuff Sojourner never even knew about!", duration: 2500, position: "cliff-edge" },
  { text: "Come on, follow me! ⬇️", duration: 2000, position: "cliff-edge" },
  { text: "I'll show you the really cool stuff...", duration: 2500, position: "descend", action: "exit" },
  { text: "*disappearing into the canyon* ✨", duration: 2000, position: "descend" },
];

const GuidoEasterEgg: React.FC<GuidoEasterEggProps> = ({ isActive, onComplete }) => {
  const { setMarsBackground, setSecretSpaceMode } = useTheme();
  const { setHideUI } = useEasterEgg();
  const { speakResponseAsync, cancelSpeech } = useAI();
  
  // Use refs for speech functions to avoid them triggering re-renders
  const speakResponseAsyncRef = useRef(speakResponseAsync);
  const cancelSpeechRef = useRef(cancelSpeech);
  
  // Keep refs updated
  useEffect(() => {
    speakResponseAsyncRef.current = speakResponseAsync;
    cancelSpeechRef.current = cancelSpeech;
  });
  
  // Track if animation was cancelled
  const animationCancelledRef = useRef(false);
  
  const [currentLine, setCurrentLine] = useState(0);
  const [guidoPosition, setGuidoPosition] = useState(-20); // Start off-screen left (percentage)
  const [_showSecret, setShowSecret] = useState(false);
  const [isWaving, setIsWaving] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [backgroundPhase, setBackgroundPhase] = useState<"mars" | "journey" | "cliff">("mars");
  const [animationComplete, setAnimationComplete] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false); // Delay overlay to let MarsBackground render first
  const [isMobile, setIsMobile] = useState(false);
  const [isDescending, setIsDescending] = useState(false); // For canyon descent animation
  
  // Track previous isActive state to detect deactivation
  const wasActiveRef = useRef(isActive);
  
  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Pre-generate dust particles
  const dustParticles = useMemo(() => generateDustParticles(20), []);

  // Wheel rotation animation
  useEffect(() => {
    if (!isActive || !isRolling) return;
    
    const interval = setInterval(() => {
      setWheelRotation(prev => (prev + 15) % 360);
    }, 50);
    
    return () => clearInterval(interval);
  }, [isActive, isRolling]);

  const handleComplete = useCallback(() => {
    // Always reset hideUI when closing
    setHideUI(false);
    
    // Stop any ongoing speech
    cancelSpeechRef.current();
    
    if (!animationComplete) {
      // If skipping early, just close
      onComplete();
    } else {
      // Animation finished naturally - keep the space background!
      setSecretSpaceMode(true);
      onComplete();
    }
  }, [animationComplete, onComplete, setSecretSpaceMode, setHideUI]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    // Track that we've been activated
    wasActiveRef.current = true;
    animationCancelledRef.current = false;

    // Enable Mars background for the animation
    setMarsBackground(true);
    
    // Small delay to let MarsBackground render before showing overlay
    const overlayTimeout = setTimeout(() => {
      setShowOverlay(true);
    }, 100);

    // Helper to process a single dialogue line
    const processLine = (line: DialogueLine, index: number) => {
      if (animationCancelledRef.current) return;
      
      setCurrentLine(index);
      
      // Handle position
      if (line.position === "left") {
        setGuidoPosition(15);
        setIsRolling(false);
      } else if (line.position === "center") {
        setGuidoPosition(45);
      } else if (line.position === "right") {
        setGuidoPosition(75);
        setIsRolling(false);
      } else if (line.position === "cliff-edge") {
        setGuidoPosition(22);
        setIsRolling(false);
        setIsDescending(false);
      } else if (line.position === "descend") {
        setGuidoPosition(50);
        setIsRolling(true);
        setIsDescending(true);
      } else if (line.position === "offscreen-right") {
        setGuidoPosition(110);
        setIsRolling(true);
      }

      // Handle actions
      if (line.action === "roll") {
        setIsRolling(true);
      } else if (line.action === "stop") {
        setIsRolling(false);
      } else if (line.action === "secret") {
        setShowSecret(true);
      } else if (line.action === "wave") {
        setIsWaving(true);
        setIsRolling(false);
      } else if (line.action === "exit") {
        setIsWaving(false);
        setIsRolling(true);
      }

      // Handle background changes
      if (line.background === "journey") {
        setBackgroundPhase("journey");
      } else if (line.background === "cliff") {
        setBackgroundPhase("cliff");
      }
      
      // Hide the settings form after line 3 (index 2) for immersive experience
      if (index === 2) {
        setHideUI(true);
      }
    };

    // Run the animation sequence asynchronously
    const runAnimation = async () => {
      // Initial delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      for (let index = 0; index < GUIDO_STORY.length; index++) {
        if (animationCancelledRef.current) break;
        
        const line = GUIDO_STORY[index];
        processLine(line, index);
        
        // Strip emojis for cleaner speech
        const cleanText = line.text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1FA00}-\u{1FAFF}]|[✕✓★⬇️]/gu, '').trim();
        
        // Check if this is an action description (wrapped in asterisks like *action*)
        const isActionDescription = /^\*.*\*$/.test(cleanText);
        
        if (cleanText && !isActionDescription) {
          // Wait for speech to complete before moving to next line
          await speakResponseAsyncRef.current(cleanText);
        } else {
          // For action descriptions, just wait the line's duration
          await new Promise(resolve => setTimeout(resolve, line.duration));
        }
        
        // Add a small pause between lines for natural pacing
        if (!animationCancelledRef.current) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      // Animation complete
      if (!animationCancelledRef.current) {
        setAnimationComplete(true);
      }
    };

    void runAnimation();

    return () => {
      console.log('[EasterEgg] CLEANUP running!');
      animationCancelledRef.current = true;
      clearTimeout(overlayTimeout);
      // Reset state when deactivating
      setCurrentLine(0);
      setGuidoPosition(-20);
      setShowSecret(false);
      setIsWaving(false);
      setIsRolling(false);
      setIsDescending(false);
      setBackgroundPhase("mars");
      setAnimationComplete(false);
      setShowOverlay(false);
      setHideUI(false);
      // Reset Mars background
      setMarsBackground(false);
      cancelSpeechRef.current(); // Stop any ongoing speech when cleaning up
    };
    // Note: speakResponse/cancelSpeech use refs so they don't need to be deps
     
  }, [isActive, setMarsBackground, setHideUI]);

  // Auto-complete after animation finishes
  useEffect(() => {
    if (animationComplete) {
      const timeout = setTimeout(() => {
        setSecretSpaceMode(true);
        onComplete();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [animationComplete, onComplete, setSecretSpaceMode]);

  if (!isActive || !showOverlay) return null;

  const currentDialogue = GUIDO_STORY[currentLine];

  // Background gradients for each phase
  // During "mars" phase, return transparent to let the actual MarsBackground show through
  const getBackgroundGradient = () => {
    if (backgroundPhase === "mars") {
      // Transparent - let the real MarsBackground component show through!
      return "transparent";
    } else if (backgroundPhase === "journey") {
      // Transition - Mars becoming darker as we travel
      return "linear-gradient(to bottom, #1a0f0a 0%, #2d1810 25%, #4a2a1a 50%, #3d2817 75%, #1a0f0a 100%)";
    } else {
      // Cliff scene - sunset/golden hour on Mars with deep canyon below
      return "linear-gradient(to bottom, #1a0505 0%, #3d1a1a 15%, #6b2a1a 30%, #c45c2a 45%, #e8a060 55%, #4a2820 70%, #1a0808 100%)";
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] cursor-pointer overflow-hidden"
      onClick={handleComplete}
      style={{
        perspective: "1000px",
        perspectiveOrigin: "50% 60%",
      }}
    >
      {/* Dynamic background based on phase - transparent during "mars" phase to show real MarsBackground */}
      <div 
        className="absolute inset-0 transition-all duration-2000"
        style={{
          background: getBackgroundGradient(),
          transition: "background 3s ease-in-out",
        }}
      />

      {/* Stars - visible in darker phases (journey/cliff) - far back layer */}
      {/* Hidden during "mars" phase since real MarsBackground has its own sky */}
      {backgroundPhase !== "mars" && (
        <div 
          style={{ 
            opacity: backgroundPhase === "journey" ? 0.6 : 0.8,
            transform: "translateZ(-200px) scale(1.2)",
            transformStyle: "preserve-3d",
          }}
        >
          <SpaceStars count={100} />
        </div>
      )}

      {/* Mars sun/Phobos - only for journey phase, mars phase uses real MarsBackground */}
      {backgroundPhase === "journey" && (
        <div 
          className="absolute w-16 h-16 rounded-full"
          style={{
            right: "15%",
            top: "20%",
            background: "radial-gradient(circle at 30% 30%, #FFFACD 0%, #FFE4B5 20%, #FFA500 50%, #FF6B35 100%)",
            boxShadow: `
              0 0 60px rgba(255, 165, 0, 0.6), 
              0 0 120px rgba(255, 100, 50, 0.3),
              inset -8px -8px 20px rgba(255, 69, 0, 0.4),
              inset 5px 5px 15px rgba(255, 255, 200, 0.6)
            `,
            filter: "blur(1px)",
            transform: "translateZ(-100px)",
          }}
        />
      )}

      {/* Journey dust particles - mid layer */}
      {backgroundPhase === "journey" && (
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{ transform: "translateZ(-50px)" }}
        >
          {dustParticles.map((particle, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: particle.size + "px",
                height: particle.size + "px",
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                background: `radial-gradient(circle at 30% 30%, rgba(255, 200, 150, 0.5), rgba(200, 120, 80, 0.2))`,
                boxShadow: "0 0 4px rgba(255, 180, 120, 0.3)",
                animation: `dustFloat ${particle.duration}s ease-in-out infinite`,
                animationDelay: `${particle.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* The Epic Cliff Scene - Using MarsCliffBackground component */}
      {backgroundPhase === "cliff" && (
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <MarsCliffBackground />
        </div>
      )}

      {/* Olympus Mons - visible during journey phase in the distance */}
      {backgroundPhase === "journey" && (
        <div
          className="absolute inset-0"
          style={{
            transform: "translateZ(-120px)",
          }}
        >
          <OlympusMons
            isErupting={true}
            positionX={50}
            scale={isMobile ? 0.7 : 1}
            opacity={0.85}
          />
        </div>
      )}

      {/* Mars terrain - only for journey phase, mars phase uses real MarsBackground */}
      {backgroundPhase === "journey" && (
        <>
          {/* Very distant mountains - furthest layer */}
          <div 
            className="absolute w-full"
            style={{
              bottom: "30%",
              height: "25%",
              background: "linear-gradient(to bottom, #2d1510 0%, #1a0a08 100%)",
              clipPath: "polygon(0 80%, 15% 55%, 30% 70%, 50% 40%, 65% 60%, 85% 35%, 100% 50%, 100% 100%, 0 100%)",
              opacity: 0.5,
              filter: "blur(2px)",
              transform: "translateZ(-150px) scale(1.08)",
              transition: "all 2s ease-in-out",
            }}
          />
          
          {/* Distant mountains - mid-far layer */}
          <div 
            className="absolute w-full"
            style={{
              bottom: "20%",
              height: "30%",
              background: "linear-gradient(to bottom, #3d2015 0%, #2d1510 100%)",
              clipPath: "polygon(0 70%, 10% 50%, 20% 65%, 35% 35%, 45% 55%, 60% 30%, 75% 50%, 85% 40%, 100% 55%, 100% 100%, 0 100%)",
              boxShadow: "inset 0 10px 30px rgba(0, 0, 0, 0.2)",
              transform: "translateZ(-80px) scale(1.04)",
              transition: "all 2s ease-in-out",
            }}
          />
          
          {/* Ground - foreground */}
          <div 
            className="absolute w-full"
            style={{
              bottom: 0,
              height: "25%",
              background: "linear-gradient(175deg, #5a3525 0%, #4a2a1a 20%, #2d1510 50%, #1a0a08 100%)",
              boxShadow: `
                inset 0 15px 40px rgba(100, 60, 40, 0.3),
                inset 0 -5px 20px rgba(0, 0, 0, 0.4)
              `,
              transform: "translateZ(0px)",
              transition: "all 2s ease-in-out",
            }}
          />
          
          {/* Ground texture details */}
          <div 
            className="absolute"
            style={{
              bottom: "8%",
              left: "20%",
              width: isMobile ? "24px" : "40px",
              height: isMobile ? "12px" : "20px",
              background: "linear-gradient(135deg, #3d2015 0%, #2d1510 100%)",
              borderRadius: "50%",
              transform: "translateZ(10px)",
              boxShadow: "2px 2px 6px rgba(0, 0, 0, 0.3)",
              transition: "all 2s ease-in-out",
            }}
          />
          <div 
            className="absolute"
            style={{
              bottom: "5%",
              left: "45%",
              width: isMobile ? "18px" : "30px",
              height: isMobile ? "9px" : "15px",
              background: "linear-gradient(135deg, #2d1510 0%, #1a0a08 100%)",
              borderRadius: "45% 55% 50% 50%",
              transform: "translateZ(8px)",
              boxShadow: "2px 2px 4px rgba(0, 0, 0, 0.25)",
              transition: "all 2s ease-in-out",
            }}
          />
        </>
      )}

      {/* Guido's shadow on the ground */}
      <div
        className="absolute transition-all ease-in-out"
        style={{ 
          left: `${guidoPosition}%`, 
          bottom: backgroundPhase === "cliff" ? (isMobile ? "18%" : "28%") : (isMobile ? "8%" : "12%"),
          transform: `translateX(-50%) scaleY(0.3) scaleX(${isDescending ? 0.5 : 1.1})`,
          width: isMobile ? "60px" : "100px",
          height: isMobile ? "24px" : "40px",
          background: "radial-gradient(ellipse, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.1) 50%, transparent 70%)",
          filter: isMobile ? "blur(5px)" : "blur(8px)",
          transition: isDescending ? "all 2s ease-in" : (isRolling ? "left 1.5s ease-in-out" : "left 0.8s ease-out"),
          opacity: isDescending ? 0 : (guidoPosition > 0 && guidoPosition < 100 ? 1 : 0),
        }}
      />

      {/* Guido Robot */}
      <div
        className="absolute transition-all ease-in-out"
        style={{ 
          left: `${guidoPosition}%`, 
          bottom: isDescending 
            ? "-20%" 
            : (backgroundPhase === "cliff" 
              ? (isMobile ? "5rem" : "10rem") 
              : (isMobile ? "3rem" : "5rem")),
          transform: `translateX(-50%) translateZ(50px) ${isDescending ? "scale(0.3)" : "scale(1)"}`,
          transition: isDescending 
            ? "all 2.5s ease-in" 
            : (isRolling ? "left 1.5s ease-in-out, bottom 0.5s ease-out" : "left 0.8s ease-out, bottom 0.5s ease-out"),
          filter: isMobile ? "drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.4))" : "drop-shadow(4px 8px 12px rgba(0, 0, 0, 0.4))",
          opacity: isDescending ? 0 : 1,
        }}
      >
        {/* Speech bubble */}
        {guidoPosition > 0 && guidoPosition < 100 && (
          <div 
            className={`absolute left-1/2 transform -translate-x-1/2 
                       bg-white text-gray-800 rounded-2xl shadow-2xl
                       text-center border-2 border-gray-100
                       ${isMobile ? "-top-20 px-3 py-2 min-w-[160px] max-w-[220px]" : "-top-32 px-5 py-4 min-w-[220px] max-w-[320px]"}`}
            style={{
              animation: "bubbleIn 0.4s ease-out",
            }}
          >
            <p className={`font-medium leading-relaxed ${isMobile ? "text-xs" : "text-base"}`}>{currentDialogue?.text}</p>
            {/* Speech bubble tail */}
            <div 
              className={`absolute left-1/2 transform -translate-x-1/2
                         w-0 h-0 border-l-transparent border-r-transparent border-t-white
                         ${isMobile ? "-bottom-2 border-l-[8px] border-r-[8px] border-t-[8px]" : "-bottom-3 border-l-[12px] border-r-[12px] border-t-[12px]"}`}
              style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.1))" }}
            />
          </div>
        )}

        {/* Guido Robot SVG - Enhanced with rolling animation */}
        <svg 
          width={isMobile ? "72" : "120"} 
          height={isMobile ? "90" : "150"} 
          viewBox="0 0 120 150"
          className={`drop-shadow-2xl ${isWaving ? "animate-bounce" : ""}`}
          style={{
            transform: isRolling ? `translateY(${Math.sin(wheelRotation * 0.05) * (isMobile ? 2 : 3)}px)` : undefined,
          }}
        >
          {/* Antenna */}
          <line x1="45" y1="15" x2="45" y2="5" stroke="#4A4A4A" strokeWidth="2" />
          <circle cx="45" cy="3" r="3" fill={isRolling ? "#FFD700" : "#4A4A4A"}>
            {isRolling && <animate attributeName="fill" values="#FFD700;#FF6B6B;#4ECDC4;#FFD700" dur="0.5s" repeatCount="indefinite" />}
          </circle>
          <line x1="75" y1="15" x2="75" y2="5" stroke="#4A4A4A" strokeWidth="2" />
          <circle cx="75" cy="3" r="3" fill={isRolling ? "#FFD700" : "#4A4A4A"}>
            {isRolling && <animate attributeName="fill" values="#4ECDC4;#FFD700;#FF6B6B;#4ECDC4" dur="0.5s" repeatCount="indefinite" />}
          </circle>
          
          {/* Head */}
          <rect x="25" y="15" width="70" height="50" rx="10" fill="#E8E8E8" stroke="#4A4A4A" strokeWidth="2" />
          
          {/* Eyes */}
          <circle cx="45" cy="40" r="12" fill="#2C2C2C" stroke="#4A4A4A" strokeWidth="2" />
          <circle cx="75" cy="40" r="12" fill="#2C2C2C" stroke="#4A4A4A" strokeWidth="2" />
          <circle cx="47" cy="38" r="4" fill="white" />
          <circle cx="77" cy="38" r="4" fill="white" />
          {/* Happy expression when waving */}
          {isWaving && (
            <>
              <path d="M 40 48 Q 45 52, 50 48" stroke="white" strokeWidth="2" fill="none" />
              <path d="M 70 48 Q 75 52, 80 48" stroke="white" strokeWidth="2" fill="none" />
            </>
          )}
          
          {/* Ear pieces */}
          <rect x="15" y="30" width="10" height="20" rx="3" fill="#8A8A8A" />
          <rect x="95" y="30" width="10" height="20" rx="3" fill="#8A8A8A" />
          
          {/* Neck */}
          <rect x="50" y="65" width="20" height="10" fill="#4A4A4A" />
          
          {/* Body */}
          <rect x="25" y="75" width="70" height="45" rx="8" fill="#E8E8E8" stroke="#4A4A4A" strokeWidth="2" />
          
          {/* Chest plate with GUIDO label */}
          <rect x="35" y="85" width="50" height="25" rx="5" fill="#F5B800" stroke="#4A4A4A" strokeWidth="1" />
          <text x="60" y="102" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#2C2C2C">GUIDO</text>
          
          {/* Arms */}
          <g 
            style={isWaving ? { 
              transformOrigin: "10px 80px",
              animation: "wave 0.3s ease-in-out infinite alternate" 
            } : {}}
          >
            <rect x="5" y="80" width="15" height="8" rx="3" fill="#8A8A8A" />
            <rect x="0" y="88" width="10" height="25" rx="3" fill="#E8E8E8" stroke="#4A4A4A" strokeWidth="1" />
            <rect x="0" y="113" width="12" height="8" rx="2" fill="#8A8A8A" />
          </g>
          <g>
            <rect x="100" y="80" width="15" height="8" rx="3" fill="#8A8A8A" />
            <rect x="110" y="88" width="10" height="25" rx="3" fill="#E8E8E8" stroke="#4A4A4A" strokeWidth="1" />
            <rect x="108" y="113" width="12" height="8" rx="2" fill="#8A8A8A" />
          </g>
          
          {/* Lower body */}
          <rect x="40" y="120" width="40" height="15" rx="5" fill="#F5B800" stroke="#4A4A4A" strokeWidth="1" />
          
          {/* Wheels with rotation */}
          <g style={{ transformOrigin: "35px 145px", transform: `rotate(${wheelRotation}deg)` }}>
            <ellipse cx="35" cy="145" rx="15" ry="8" fill="#3A3A3A" />
            <ellipse cx="35" cy="143" rx="12" ry="5" fill="#5A5A5A" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={`left-${i}`}
                x1={35 + Math.cos(i * Math.PI / 3) * 10}
                y1={145 + Math.sin(i * Math.PI / 3) * 6}
                x2={35 + Math.cos(i * Math.PI / 3) * 14}
                y2={145 + Math.sin(i * Math.PI / 3) * 7}
                stroke="#2A2A2A"
                strokeWidth="2"
              />
            ))}
          </g>
          <g style={{ transformOrigin: "85px 145px", transform: `rotate(${wheelRotation}deg)` }}>
            <ellipse cx="85" cy="145" rx="15" ry="8" fill="#3A3A3A" />
            <ellipse cx="85" cy="143" rx="12" ry="5" fill="#5A5A5A" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={`right-${i}`}
                x1={85 + Math.cos(i * Math.PI / 3) * 10}
                y1={145 + Math.sin(i * Math.PI / 3) * 6}
                x2={85 + Math.cos(i * Math.PI / 3) * 14}
                y2={145 + Math.sin(i * Math.PI / 3) * 7}
                stroke="#2A2A2A"
                strokeWidth="2"
              />
            ))}
          </g>
        </svg>
      </div>

      {/* Progress indicator */}
      <div className={`absolute left-1/2 transform -translate-x-1/2 flex items-center ${isMobile ? "bottom-6 gap-1" : "bottom-8 gap-2"}`}>
        {GUIDO_STORY.map((_, i) => (
          <div 
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i <= currentLine ? "bg-white" : "bg-white/30"
            } ${isMobile ? "w-1.5 h-1.5" : "w-2 h-2"}`}
          />
        ))}
      </div>

      {/* Click hint */}
      <div className={`absolute left-1/2 transform -translate-x-1/2 text-white/50 ${isMobile ? "bottom-2 text-[10px]" : "bottom-3 text-xs"}`}>
        {isMobile ? "Tap to skip" : "Click anywhere to skip"}
      </div>

      <style>{`
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.9); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes wave {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-30deg); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(255,255,255,0.8)); }
          50% { filter: drop-shadow(0 0 40px rgba(138,43,226,0.9)); }
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes dustFloat {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          25% { transform: translate(10px, -15px) scale(1.1); opacity: 0.5; }
          50% { transform: translate(-5px, -25px) scale(0.9); opacity: 0.4; }
          75% { transform: translate(15px, -10px) scale(1.05); opacity: 0.35; }
        }
      `}</style>
    </div>
  );
};

export default GuidoEasterEgg;
