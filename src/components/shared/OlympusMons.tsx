import React, { useState, useEffect, useMemo } from "react";

/**
 * Olympus Mons Component - The largest volcano in the solar system
 * 
 * Displays an erupting Olympus Mons with:
 * - Massive shield volcano silhouette
 * - Active eruption with fire/smoke plume
 * - Lava flows down the slopes
 * - Glowing crater
 * - Responsive design for mobile
 * 
 * Fun facts:
 * - Olympus Mons is 21.9 km tall (nearly 3x Everest)
 * - The caldera is 80 km wide
 * - The base is 600 km in diameter
 * - It's so large, standing at the edge you couldn't see the summit (it curves beyond the horizon)
 */

interface LavaParticle {
  id: number;
  x: number;
  startY: number;
  size: number;
  speed: number;
  wobble: number;
  delay: number;
  brightness: number;
}

interface SmokeParticle {
  id: number;
  x: number;
  size: number;
  speed: number;
  drift: number;
  delay: number;
  opacity: number;
}

interface EmberParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

interface OlympusMonsProps {
  /** Whether the volcano is actively erupting */
  isErupting?: boolean;
  /** Position from left (percentage) */
  positionX?: number;
  /** Scale factor (1 = normal size) */
  scale?: number;
  /** Opacity for distance effect */
  opacity?: number;
}

// Pre-generate particles for performance
const generateLavaParticles = (count: number): LavaParticle[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 45 + Math.random() * 10, // Around crater area (percentage of volcano width)
    startY: 15 + Math.random() * 5,
    size: Math.random() * 4 + 2,
    speed: 4 + Math.random() * 3,
    wobble: Math.random() * 10 - 5,
    delay: Math.random() * 2,
    brightness: 0.7 + Math.random() * 0.3,
  }));
};

const generateSmokeParticles = (count: number): SmokeParticle[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 42 + Math.random() * 16,
    size: 20 + Math.random() * 40,
    speed: 6 + Math.random() * 4,
    drift: Math.random() * 30 - 15,
    delay: Math.random() * 3,
    opacity: 0.3 + Math.random() * 0.4,
  }));
};

const generateEmbers = (count: number): EmberParticle[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 40 + Math.random() * 20,
    y: 5 + Math.random() * 15,
    size: 1 + Math.random() * 2,
    duration: 1.5 + Math.random() * 2,
    delay: Math.random() * 3,
  }));
};

const OlympusMons: React.FC<OlympusMonsProps> = ({
  isErupting = true,
  positionX = 50,
  scale = 1,
  opacity = 1,
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Pre-generate particles
  const lavaParticles = useMemo(
    () => generateLavaParticles(isMobile ? 8 : 15),
    [isMobile]
  );
  const smokeParticles = useMemo(
    () => generateSmokeParticles(isMobile ? 6 : 12),
    [isMobile]
  );
  const embers = useMemo(
    () => generateEmbers(isMobile ? 10 : 20),
    [isMobile]
  );

  const baseWidth = isMobile ? 180 : 300;
  const baseHeight = isMobile ? 120 : 200;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${positionX}%`,
        bottom: isMobile ? "18%" : "22%",
        transform: `translateX(-50%) scale(${scale})`,
        width: `${baseWidth}px`,
        height: `${baseHeight}px`,
        opacity,
        zIndex: 5,
      }}
    >
      {/* Volcanic glow on clouds/sky behind */}
      {isErupting && (
        <div
          className="absolute"
          style={{
            left: "30%",
            top: "-30%",
            width: "40%",
            height: "60%",
            background: `radial-gradient(ellipse 100% 100% at 50% 100%, 
              rgba(255, 100, 50, 0.4) 0%, 
              rgba(255, 60, 20, 0.2) 40%, 
              transparent 70%)`,
            filter: isMobile ? "blur(15px)" : "blur(25px)",
            animation: "volcanoGlow 2s ease-in-out infinite alternate",
          }}
        />
      )}

      {/* Smoke/ash plume - behind the mountain */}
      {isErupting && (
        <div className="absolute inset-0 overflow-visible" style={{ zIndex: 1 }}>
          {smokeParticles.map((particle) => (
            <div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                left: `${particle.x}%`,
                bottom: "75%",
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                background: `radial-gradient(circle at 40% 40%, 
                  rgba(80, 60, 50, ${particle.opacity}) 0%, 
                  rgba(50, 40, 35, ${particle.opacity * 0.6}) 50%, 
                  transparent 70%)`,
                animation: `smokeRise ${particle.speed}s ease-out infinite`,
                animationDelay: `${particle.delay}s`,
                filter: "blur(3px)",
              }}
            />
          ))}
        </div>
      )}

      {/* Main volcano body - shield volcano shape */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "100%",
          zIndex: 2,
        }}
      >
        {/* Base layer - darkest, furthest */}
        <div
          className="absolute bottom-0"
          style={{
            left: "-5%",
            width: "110%",
            height: "95%",
            background: `linear-gradient(to top, 
              #1a0f0a 0%, 
              #2d1810 30%, 
              #3d2015 60%, 
              #2a1510 80%, 
              #1a0a05 100%)`,
            clipPath: "polygon(0 100%, 15% 70%, 30% 45%, 42% 25%, 50% 15%, 58% 25%, 70% 45%, 85% 70%, 100% 100%)",
          }}
        />

        {/* Mid layer with texture */}
        <div
          className="absolute bottom-0"
          style={{
            left: "0%",
            width: "100%",
            height: "90%",
            background: `linear-gradient(135deg, 
              #3d2518 0%, 
              #4a2a1a 25%, 
              #3d2015 50%, 
              #2d1510 75%, 
              #1a0a08 100%)`,
            clipPath: "polygon(5% 100%, 18% 68%, 32% 42%, 44% 22%, 50% 12%, 56% 22%, 68% 42%, 82% 68%, 95% 100%)",
          }}
        />

        {/* Highlight on left slope (sun-lit side) */}
        <div
          className="absolute bottom-0"
          style={{
            left: "5%",
            width: "45%",
            height: "85%",
            background: `linear-gradient(120deg, 
              rgba(100, 60, 40, 0.4) 0%, 
              rgba(80, 45, 30, 0.2) 40%, 
              transparent 70%)`,
            clipPath: "polygon(0 100%, 28% 65%, 55% 35%, 80% 15%, 100% 100%)",
          }}
        />

        {/* Shadow on right slope */}
        <div
          className="absolute bottom-0"
          style={{
            right: "5%",
            width: "45%",
            height: "85%",
            background: `linear-gradient(240deg, 
              rgba(0, 0, 0, 0.4) 0%, 
              rgba(0, 0, 0, 0.2) 40%, 
              transparent 70%)`,
            clipPath: "polygon(100% 100%, 72% 65%, 45% 35%, 20% 15%, 0% 100%)",
          }}
        />

        {/* Caldera/crater at summit */}
        <div
          className="absolute"
          style={{
            left: "42%",
            top: "8%",
            width: "16%",
            height: "12%",
            background: isErupting
              ? `radial-gradient(ellipse 100% 80% at 50% 60%, 
                  rgba(255, 200, 100, 0.9) 0%, 
                  rgba(255, 120, 50, 0.8) 30%, 
                  rgba(200, 60, 20, 0.6) 60%, 
                  rgba(80, 30, 10, 0.8) 100%)`
              : `radial-gradient(ellipse 100% 80% at 50% 60%, 
                  rgba(60, 30, 15, 1) 0%, 
                  rgba(40, 20, 10, 1) 60%, 
                  rgba(30, 15, 8, 1) 100%)`,
            borderRadius: "50%",
            boxShadow: isErupting
              ? `0 0 20px rgba(255, 100, 50, 0.8), 
                 0 0 40px rgba(255, 60, 20, 0.5), 
                 inset 0 2px 10px rgba(255, 200, 100, 0.6)`
              : "inset 0 2px 8px rgba(0, 0, 0, 0.5)",
            animation: isErupting ? "craterPulse 1.5s ease-in-out infinite" : undefined,
          }}
        />

        {/* Lava flows down the slopes */}
        {isErupting && (
          <>
            {/* Main lava river - left side */}
            <div
              className="absolute"
              style={{
                left: "35%",
                top: "18%",
                width: "8%",
                height: "75%",
                background: `linear-gradient(180deg, 
                  rgba(255, 180, 80, 0.9) 0%, 
                  rgba(255, 120, 40, 0.85) 20%, 
                  rgba(255, 80, 20, 0.8) 40%, 
                  rgba(200, 50, 10, 0.7) 60%, 
                  rgba(150, 30, 5, 0.6) 80%, 
                  rgba(80, 20, 5, 0.4) 100%)`,
                clipPath: "polygon(40% 0, 60% 0, 80% 30%, 100% 60%, 90% 100%, 10% 100%, 0% 70%, 20% 40%)",
                filter: "blur(1px)",
                animation: "lavaFlow 3s ease-in-out infinite",
              }}
            />
            {/* Lava glow */}
            <div
              className="absolute"
              style={{
                left: "33%",
                top: "15%",
                width: "12%",
                height: "80%",
                background: `linear-gradient(180deg, 
                  rgba(255, 150, 50, 0.4) 0%, 
                  rgba(255, 100, 30, 0.3) 30%, 
                  rgba(200, 50, 10, 0.2) 60%, 
                  transparent 100%)`,
                filter: isMobile ? "blur(6px)" : "blur(10px)",
                animation: "lavaGlow 2s ease-in-out infinite alternate",
              }}
            />

            {/* Secondary lava flow - right side */}
            <div
              className="absolute"
              style={{
                right: "38%",
                top: "20%",
                width: "6%",
                height: "65%",
                background: `linear-gradient(180deg, 
                  rgba(255, 160, 60, 0.85) 0%, 
                  rgba(255, 100, 30, 0.8) 25%, 
                  rgba(220, 60, 15, 0.7) 50%, 
                  rgba(160, 40, 10, 0.5) 75%, 
                  rgba(100, 25, 5, 0.3) 100%)`,
                clipPath: "polygon(30% 0, 70% 0, 90% 40%, 100% 100%, 0% 100%, 10% 50%)",
                filter: "blur(1px)",
                animation: "lavaFlow 3.5s ease-in-out infinite",
                animationDelay: "0.5s",
              }}
            />

            {/* Small lava tributary */}
            <div
              className="absolute"
              style={{
                left: "28%",
                top: "45%",
                width: "4%",
                height: "50%",
                background: `linear-gradient(180deg, 
                  rgba(255, 140, 50, 0.7) 0%, 
                  rgba(200, 80, 20, 0.5) 50%, 
                  rgba(120, 40, 10, 0.3) 100%)`,
                clipPath: "polygon(20% 0, 80% 0, 100% 100%, 0% 100%)",
                filter: "blur(1px)",
                animation: "lavaFlow 4s ease-in-out infinite",
                animationDelay: "1s",
              }}
            />
          </>
        )}

        {/* Rocky texture details */}
        <div
          className="absolute bottom-0"
          style={{
            left: "20%",
            width: "60%",
            height: "70%",
            opacity: 0.3,
            background: `
              radial-gradient(ellipse 8px 6px at 25% 60%, rgba(60, 35, 20, 0.6) 0%, transparent 100%),
              radial-gradient(ellipse 12px 8px at 45% 45%, rgba(50, 30, 18, 0.5) 0%, transparent 100%),
              radial-gradient(ellipse 6px 5px at 65% 55%, rgba(70, 40, 25, 0.6) 0%, transparent 100%),
              radial-gradient(ellipse 10px 7px at 55% 70%, rgba(55, 32, 20, 0.5) 0%, transparent 100%),
              radial-gradient(ellipse 8px 6px at 35% 75%, rgba(65, 38, 22, 0.5) 0%, transparent 100%)
            `,
          }}
        />
      </div>

      {/* Fire/eruption plume - in front */}
      {isErupting && (
        <div className="absolute inset-0 overflow-visible" style={{ zIndex: 3 }}>
          {/* Central fire column */}
          <div
            className="absolute"
            style={{
              left: "44%",
              bottom: "85%",
              width: "12%",
              height: "40%",
              background: `linear-gradient(to top, 
                rgba(255, 200, 100, 0.9) 0%, 
                rgba(255, 150, 50, 0.8) 20%, 
                rgba(255, 100, 30, 0.6) 40%, 
                rgba(255, 60, 20, 0.4) 60%, 
                rgba(200, 40, 10, 0.2) 80%, 
                transparent 100%)`,
              filter: isMobile ? "blur(2px)" : "blur(3px)",
              animation: "fireFlicker 0.3s ease-in-out infinite",
              transformOrigin: "bottom center",
            }}
          />

          {/* Fire tongues */}
          <div
            className="absolute"
            style={{
              left: "42%",
              bottom: "90%",
              width: "6%",
              height: "25%",
              background: `linear-gradient(to top, 
                rgba(255, 220, 120, 0.9) 0%, 
                rgba(255, 150, 50, 0.7) 40%, 
                rgba(255, 80, 20, 0.4) 70%, 
                transparent 100%)`,
              filter: "blur(2px)",
              animation: "fireFlicker 0.25s ease-in-out infinite",
              animationDelay: "0.1s",
              transformOrigin: "bottom center",
            }}
          />
          <div
            className="absolute"
            style={{
              left: "52%",
              bottom: "88%",
              width: "5%",
              height: "20%",
              background: `linear-gradient(to top, 
                rgba(255, 200, 100, 0.85) 0%, 
                rgba(255, 120, 40, 0.6) 50%, 
                transparent 100%)`,
              filter: "blur(2px)",
              animation: "fireFlicker 0.35s ease-in-out infinite",
              animationDelay: "0.15s",
              transformOrigin: "bottom center",
            }}
          />

          {/* Lava particles shooting up */}
          {lavaParticles.map((particle) => (
            <div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                left: `${particle.x}%`,
                bottom: `${75 + particle.startY}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                background: `radial-gradient(circle at 30% 30%, 
                  rgba(255, 255, 200, ${particle.brightness}) 0%, 
                  rgba(255, 180, 80, ${particle.brightness * 0.9}) 30%, 
                  rgba(255, 100, 40, ${particle.brightness * 0.7}) 60%, 
                  rgba(200, 50, 10, ${particle.brightness * 0.4}) 100%)`,
                boxShadow: `0 0 ${particle.size * 2}px rgba(255, 150, 50, 0.8)`,
                animation: `lavaParticle ${particle.speed}s ease-out infinite`,
                animationDelay: `${particle.delay}s`,
              }}
            />
          ))}

          {/* Embers floating */}
          {embers.map((ember) => (
            <div
              key={ember.id}
              className="absolute rounded-full"
              style={{
                left: `${ember.x}%`,
                bottom: `${80 + ember.y}%`,
                width: `${ember.size}px`,
                height: `${ember.size}px`,
                background: `radial-gradient(circle, 
                  rgba(255, 200, 100, 0.9) 0%, 
                  rgba(255, 120, 50, 0.6) 50%, 
                  transparent 100%)`,
                animation: `emberFloat ${ember.duration}s ease-in-out infinite`,
                animationDelay: `${ember.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Atmospheric haze around base */}
      <div
        className="absolute"
        style={{
          left: "-20%",
          bottom: "-10%",
          width: "140%",
          height: "40%",
          background: `linear-gradient(to top, 
            rgba(45, 25, 15, 0.5) 0%, 
            rgba(60, 35, 20, 0.3) 40%, 
            transparent 100%)`,
          filter: isMobile ? "blur(8px)" : "blur(15px)",
        }}
      />

      <style>{`
        @keyframes volcanoGlow {
          0% { opacity: 0.8; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.1); }
        }
        
        @keyframes craterPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        
        @keyframes lavaFlow {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        
        @keyframes lavaGlow {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }
        
        @keyframes fireFlicker {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          25% { transform: scaleY(1.1) scaleX(0.95); }
          50% { transform: scaleY(0.95) scaleX(1.05); }
          75% { transform: scaleY(1.05) scaleX(0.98); }
        }
        
        @keyframes smokeRise {
          0% { 
            transform: translateY(0) translateX(0) scale(0.5); 
            opacity: 0.6; 
          }
          50% { 
            opacity: 0.4; 
          }
          100% { 
            transform: translateY(-150px) translateX(var(--drift, 20px)) scale(2); 
            opacity: 0; 
          }
        }
        
        @keyframes lavaParticle {
          0% { 
            transform: translateY(0) translateX(0) scale(1); 
            opacity: 1; 
          }
          50% {
            opacity: 0.8;
          }
          100% { 
            transform: translateY(-80px) translateX(var(--wobble, 10px)) scale(0.3); 
            opacity: 0; 
          }
        }
        
        @keyframes emberFloat {
          0%, 100% { 
            transform: translateY(0) translateX(0); 
            opacity: 0.8; 
          }
          25% { 
            transform: translateY(-15px) translateX(5px); 
            opacity: 1; 
          }
          50% { 
            transform: translateY(-25px) translateX(-3px); 
            opacity: 0.6; 
          }
          75% { 
            transform: translateY(-35px) translateX(8px); 
            opacity: 0.4; 
          }
        }
      `}</style>
    </div>
  );
};

export default OlympusMons;
