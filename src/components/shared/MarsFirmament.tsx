import React, { useMemo, useState, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

/**
 * Mars Firmament Component - Shared sky for all Mars backgrounds
 * 
 * Displays a realistic Mars sky with day/night cycle driven by themeBlend.
 * Responsive design adapts to mobile viewports.
 * 
 * Mars atmospheric facts:
 * - Sunsets on Mars are BLUE (not orange like Earth) due to fine dust scattering
 * - Daytime sky is butterscotch/salmon colored  
 * - Night sky is deep purple-black with brilliant stars
 * - Sun appears ~2/3 the size it does from Earth
 * - Phobos (larger, closer, irregular) and Deimos (smaller, distant) visible at night
 * - Phobos orbits so fast it rises in the west and sets in the east!
 */

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleDelay: number;
  color: string;
}

interface MarsFirmamentProps {
  /** Override the theme blend value (0-100). If not provided, uses themeBlend from context */
  blend?: number;
  /** Limit stars to upper portion of sky. Default 50 (percent) */
  starFieldHeight?: number;
}

// Pre-generate stars for performance
const generateStars = (count: number, maxY: number, isMobile: boolean): Star[] => {
  const colors = [
    "rgba(255, 255, 255,",      // White
    "rgba(255, 220, 180,",      // Warm white
    "rgba(200, 220, 255,",      // Cool blue-white
    "rgba(255, 200, 150,",      // Orange tint
  ];
  
  // Smaller stars on mobile
  const sizeMultiplier = isMobile ? 0.7 : 1;
  
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    y: Math.random() * maxY,
    size: (Math.random() * 2 + 0.5) * sizeMultiplier,
    brightness: Math.random() * 0.5 + 0.5,
    twinkleDelay: Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
};

const MarsFirmament: React.FC<MarsFirmamentProps> = ({ 
  blend,
  starFieldHeight = 50 
}) => {
  const { themeBlend } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Use provided blend or context value
  const progress = (blend ?? themeBlend) / 100;
  
  // Pre-generate stars - fewer on mobile for performance
  const stars = useMemo(() => generateStars(isMobile ? 60 : 100, starFieldHeight, isMobile), [starFieldHeight, isMobile]);
  
  // Sun position - arc across the sky (left to right, peak at ~30%)
  const sunX = 8 + progress * 84;
  const arcPeak = 0.30;
  const normalizedProgress = (progress - arcPeak);
  const sunY = 10 + Math.pow(normalizedProgress, 2) * 140;
  
  // Sun visibility - fades as it approaches horizon
  const sunBelowHorizon = sunY > 52;
  const sunOpacity = sunBelowHorizon ? 0 : Math.max(0, 1 - (sunY - 35) / 20);
  
  // Moon visibility (Phobos and Deimos appear as sun sets)
  const moonOpacity = Math.max(0, (progress - 0.5) / 0.35);
  
  // Blue sunset glow intensity (Mars specialty!)
  // Peaks during sunset transition
  const blueGlowIntensity = progress > 0.38 && progress < 0.72 
    ? Math.sin((progress - 0.38) / 0.34 * Math.PI) * 0.7 
    : 0;

  // Sky gradient - realistic Mars colors
  const getSkyGradient = () => {
    if (progress <= 0.20) {
      // Early day - bright butterscotch sky
      return `linear-gradient(to bottom, 
        #E8C4A0 0%, 
        #D4A574 20%, 
        #C4956A 40%, 
        #B8825A 60%,
        #A06040 80%,
        #8B5035 100%)`;
    } else if (progress <= 0.40) {
      // Afternoon - warming colors
      const t = (progress - 0.20) / 0.20;
      return `linear-gradient(to bottom, 
        rgb(${232 - t * 60}, ${196 - t * 50}, ${160 - t * 40}) 0%, 
        rgb(${212 - t * 55}, ${165 - t * 45}, ${116 - t * 30}) 20%, 
        rgb(${196 - t * 50}, ${149 - t * 40}, ${106 - t * 25}) 40%,
        rgb(${184 - t * 50}, ${130 - t * 40}, ${90 - t * 20}) 60%,
        rgb(${160 - t * 45}, ${96 - t * 30}, ${64 - t * 15}) 80%,
        rgb(${139 - t * 40}, ${80 - t * 25}, ${53 - t * 12}) 100%)`;
    } else if (progress <= 0.55) {
      // Sunset - the famous Mars BLUE sunset!
      const t = (progress - 0.40) / 0.15;
      return `linear-gradient(to bottom, 
        rgb(${172 - t * 70}, ${146 - t * 50}, ${120 + t * 30}) 0%, 
        rgb(${157 - t * 65}, ${120 - t * 40}, ${86 + t * 50}) 20%, 
        rgb(${146 - t * 60}, ${109 - t * 40}, ${81 + t * 60}) 40%,
        rgb(${134 - t * 55}, ${90 - t * 35}, ${70 + t * 40}) 60%,
        rgb(${115 - t * 50}, ${66 - t * 25}, ${49 + t * 30}) 80%,
        rgb(${99 - t * 45}, ${55 - t * 22}, ${41 + t * 20}) 100%)`;
    } else if (progress <= 0.70) {
      // Deep sunset / blue hour
      const t = (progress - 0.55) / 0.15;
      return `linear-gradient(to bottom, 
        rgb(${102 - t * 55}, ${96 - t * 50}, ${150 - t * 50}) 0%, 
        rgb(${92 - t * 50}, ${80 - t * 45}, ${136 - t * 50}) 20%, 
        rgb(${86 - t * 50}, ${69 - t * 40}, ${141 - t * 60}) 40%,
        rgb(${79 - t * 45}, ${55 - t * 30}, ${110 - t * 50}) 60%,
        rgb(${65 - t * 40}, ${41 - t * 22}, ${79 - t * 40}) 80%,
        rgb(${54 - t * 32}, ${33 - t * 18}, ${61 - t * 35}) 100%)`;
    } else if (progress <= 0.85) {
      // Twilight
      const t = (progress - 0.70) / 0.15;
      return `linear-gradient(to bottom, 
        rgb(${47 - t * 30}, ${46 - t * 30}, ${100 - t * 60}) 0%, 
        rgb(${42 - t * 28}, ${35 - t * 25}, ${86 - t * 55}) 20%, 
        rgb(${36 - t * 24}, ${29 - t * 20}, ${81 - t * 55}) 40%,
        rgb(${34 - t * 22}, ${25 - t * 16}, ${60 - t * 40}) 60%,
        rgb(${25 - t * 16}, ${19 - t * 12}, ${39 - t * 26}) 80%,
        rgb(${22 - t * 14}, ${15 - t * 10}, ${26 - t * 18}) 100%)`;
    } else {
      // Night - deep purple-black
      return `linear-gradient(to bottom, 
        #0d0818 0%, 
        #0a0612 20%, 
        #080410 40%,
        #0c0610 60%,
        #060308 80%,
        #030204 100%)`;
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Sky gradient */}
      <div 
        className="absolute inset-0 transition-all duration-1000"
        style={{ background: getSkyGradient() }}
      />

      {/* Stars - fade in during dusk, full at night */}
      <div 
        className="absolute inset-0 transition-opacity duration-1000"
        style={{ opacity: Math.max(0, (progress - 0.52) / 0.38) }}
      >
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              background: `${star.color}${star.brightness})`,
              boxShadow: `0 0 ${star.size * 2}px ${star.color}${star.brightness * 0.5})`,
              animation: `marsTwinkle ${2.5 + star.twinkleDelay}s ease-in-out infinite`,
              animationDelay: `${star.twinkleDelay}s`,
            }}
          />
        ))}
      </div>

      {/* The Sun */}
      {!sunBelowHorizon && (
        <div
          className="absolute transition-all duration-500"
          style={{
            left: `${sunX}%`,
            top: `${sunY}%`,
            transform: "translate(-50%, -50%)",
            opacity: sunOpacity,
          }}
        >
          {/* Outer atmospheric glow */}
          <div
            className="absolute rounded-full"
            style={{
              width: isMobile ? "120px" : "200px",
              height: isMobile ? "120px" : "200px",
              left: isMobile ? "-60px" : "-100px",
              top: isMobile ? "-60px" : "-100px",
              background: `radial-gradient(circle, 
                rgba(255, 200, 120, ${0.25 * sunOpacity}) 0%, 
                rgba(255, 160, 80, ${0.12 * sunOpacity}) 40%, 
                transparent 70%)`,
              filter: isMobile ? "blur(10px)" : "blur(15px)",
            }}
          />
          {/* Blue halo during sunset (Mars specialty!) */}
          {blueGlowIntensity > 0 && (
            <div
              className="absolute rounded-full"
              style={{
                width: isMobile ? "170px" : "280px",
                height: isMobile ? "170px" : "280px",
                left: isMobile ? "-85px" : "-140px",
                top: isMobile ? "-85px" : "-140px",
                background: `radial-gradient(circle, 
                  rgba(100, 150, 220, ${blueGlowIntensity * 0.35}) 0%, 
                  rgba(80, 120, 200, ${blueGlowIntensity * 0.2}) 30%, 
                  rgba(60, 100, 180, ${blueGlowIntensity * 0.1}) 50%,
                  transparent 70%)`,
                filter: isMobile ? "blur(18px)" : "blur(25px)",
              }}
            />
          )}
          {/* Inner warm glow */}
          <div
            className="absolute rounded-full"
            style={{
              width: isMobile ? "60px" : "100px",
              height: isMobile ? "60px" : "100px",
              left: isMobile ? "-30px" : "-50px",
              top: isMobile ? "-30px" : "-50px",
              background: `radial-gradient(circle, 
                rgba(255, 230, 170, 0.5) 0%, 
                rgba(255, 190, 100, 0.2) 50%, 
                transparent 70%)`,
              filter: isMobile ? "blur(5px)" : "blur(8px)",
            }}
          />
          {/* Sun disk - smaller on Mars due to distance */}
          <div
            className="rounded-full"
            style={{
              width: isMobile ? "24px" : "38px",
              height: isMobile ? "24px" : "38px",
              background: `radial-gradient(circle at 40% 40%, 
                #FFFAF0 0%, 
                #FFE8C0 30%, 
                #FFD070 60%, 
                #FFA530 100%)`,
              boxShadow: isMobile 
                ? `0 0 12px rgba(255, 220, 100, 0.9), 0 0 25px rgba(255, 180, 80, 0.6), 0 0 45px rgba(255, 140, 60, 0.3)`
                : `0 0 20px rgba(255, 220, 100, 0.9), 0 0 40px rgba(255, 180, 80, 0.6), 0 0 70px rgba(255, 140, 60, 0.3)`,
            }}
          />
        </div>
      )}

      {/* Blue glow on horizon during sunset */}
      {blueGlowIntensity > 0 && (
        <div 
          className="absolute transition-opacity duration-700"
          style={{
            left: `${Math.max(0, sunX - 25)}%`,
            bottom: "30%",
            width: "50%",
            height: "30%",
            background: `radial-gradient(ellipse 100% 80% at 50% 100%, 
              rgba(80, 140, 200, ${blueGlowIntensity * 0.35}) 0%, 
              rgba(60, 100, 180, ${blueGlowIntensity * 0.15}) 40%,
              transparent 70%)`,
            filter: "blur(30px)",
          }}
        />
      )}

      {/* Phobos - the larger, closer moon (rises in west, irregular shape) */}
      <div
        className="absolute transition-all duration-700"
        style={{
          // Phobos moves opposite direction (east to west visually for us)
          right: `${15 + (1 - progress) * 20}%`,
          top: `${12 + Math.sin(progress * Math.PI) * 8}%`,
          opacity: moonOpacity,
        }}
      >
        {/* Glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: isMobile ? "45px" : "70px",
            height: isMobile ? "45px" : "70px",
            left: isMobile ? "-22px" : "-35px",
            top: isMobile ? "-22px" : "-35px",
            background: `radial-gradient(circle, rgba(200, 200, 220, ${0.2 * moonOpacity}) 0%, transparent 60%)`,
            filter: isMobile ? "blur(5px)" : "blur(8px)",
          }}
        />
        {/* Irregular potato shape */}
        <div
          style={{
            width: isMobile ? "26px" : "40px",
            height: isMobile ? "20px" : "30px",
            background: "linear-gradient(140deg, #E0E0E0 0%, #C8C8C8 20%, #A0A0A0 50%, #6A6A6A 80%, #4A4A4A 100%)",
            borderRadius: "55% 45% 60% 40% / 50% 55% 45% 50%",
            boxShadow: isMobile
              ? `0 0 15px rgba(200, 200, 220, 0.4), 0 0 30px rgba(180, 180, 200, 0.2), inset 3px 2px 6px rgba(255, 255, 255, 0.4), inset -2px -2px 5px rgba(0, 0, 0, 0.5)`
              : `0 0 25px rgba(200, 200, 220, 0.4), 0 0 50px rgba(180, 180, 200, 0.2), inset 5px 4px 10px rgba(255, 255, 255, 0.4), inset -4px -4px 8px rgba(0, 0, 0, 0.5)`,
            transform: "rotate(-12deg)",
          }}
        >
          {/* Stickney crater - the large defining feature */}
          <div 
            style={{
              position: "absolute",
              left: "16%",
              top: "20%",
              width: isMobile ? "9px" : "14px",
              height: isMobile ? "8px" : "12px",
              background: "radial-gradient(ellipse at 35% 35%, #888 0%, #5a5a5a 60%, #404040 100%)",
              borderRadius: "50%",
              boxShadow: "inset 1.5px 1.5px 4px rgba(0, 0, 0, 0.6)",
            }}
          />
          {/* Smaller crater - hidden on mobile */}
          {!isMobile && (
            <div 
              style={{
                position: "absolute",
                right: "20%",
                bottom: "25%",
                width: "6px",
                height: "5px",
                background: "radial-gradient(ellipse, #707070 0%, #505050 100%)",
                borderRadius: "50%",
                boxShadow: "inset 0.5px 0.5px 2px rgba(0, 0, 0, 0.5)",
              }}
            />
          )}
        </div>
      </div>

      {/* Deimos - the smaller, more distant moon */}
      <div
        className="absolute transition-all duration-700"
        style={{
          // Deimos moves normally but slower (more distant)
          left: `${20 + progress * 25}%`,
          top: `${8 + Math.sin(progress * Math.PI * 0.8) * 5}%`,
          opacity: moonOpacity * 0.85,
        }}
      >
        {/* Subtle glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: isMobile ? "25px" : "40px",
            height: isMobile ? "25px" : "40px",
            left: isMobile ? "-12px" : "-20px",
            top: isMobile ? "-12px" : "-20px",
            background: `radial-gradient(circle, rgba(180, 180, 200, ${0.15 * moonOpacity}) 0%, transparent 60%)`,
            filter: isMobile ? "blur(3px)" : "blur(5px)",
          }}
        />
        <div
          style={{
            width: isMobile ? "13px" : "20px",
            height: isMobile ? "10px" : "15px",
            background: "linear-gradient(135deg, #D8D8D8 0%, #B0B0B0 40%, #787878 80%, #585858 100%)",
            borderRadius: "50% 50% 45% 55% / 55% 45% 55% 45%",
            boxShadow: isMobile
              ? `0 0 10px rgba(180, 180, 200, 0.3), inset 1px 1px 3px rgba(255, 255, 255, 0.35), inset -1px -1px 2px rgba(0, 0, 0, 0.4)`
              : `0 0 15px rgba(180, 180, 200, 0.3), inset 2px 2px 5px rgba(255, 255, 255, 0.35), inset -2px -2px 4px rgba(0, 0, 0, 0.4)`,
          }}
        >
          {/* Tiny crater - hidden on mobile */}
          {!isMobile && (
            <div 
              style={{
                position: "absolute",
                left: "30%",
                top: "30%",
                width: "4px",
                height: "3px",
                background: "radial-gradient(ellipse, #909090 0%, #686868 100%)",
                borderRadius: "50%",
              }}
            />
          )}
        </div>
      </div>

      {/* Atmospheric dust haze near horizon */}
      <div 
        className="absolute left-0 right-0 transition-all duration-700"
        style={{
          bottom: 0,
          height: "40%",
          background: `linear-gradient(to top, 
            rgba(${180 - progress * 100}, ${130 - progress * 80}, ${100 - progress * 60}, ${0.15 - progress * 0.08}) 0%, 
            transparent 100%)`,
        }}
      />

      <style>{`
        @keyframes marsTwinkle {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
};

export default MarsFirmament;
