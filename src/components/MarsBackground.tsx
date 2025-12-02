import React, { useState, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import MarsFirmament from "@/components/shared/MarsFirmament";

/**
 * Mars Background Component
 * 
 * Displays a realistic Mars surface background with the shared firmament (sky).
 * The terrain adapts its lighting based on the theme blend (day/night cycle).
 * Can be disabled via the theme settings for better performance.
 * Responsive design adapts to mobile viewports.
 */
const MarsBackground: React.FC = () => {
  const { themeBlend, marsBackground } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Return null if Mars background is disabled
  if (!marsBackground) {
    return null;
  }
  
  // Lighting factor for terrain (0 = dark, 1 = bright)
  const lighting = Math.max(0.08, 1 - (themeBlend / 100) * 1.1);

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -1 }}
    >
      {/* Shared Mars sky with sun, moons, stars */}
      <MarsFirmament starFieldHeight={45} />

      {/* Distant mountains / Olympus Mons silhouette */}
      <div 
        className="absolute bottom-0 left-0 right-0 transition-all duration-500"
        style={{ 
          height: isMobile ? "40%" : "35%",
          background: `linear-gradient(to bottom, 
            rgba(${120 * lighting + 30}, ${70 * lighting + 20}, ${40 * lighting + 15}, 0.6) 0%,
            rgba(${100 * lighting + 25}, ${55 * lighting + 15}, ${35 * lighting + 10}, 0.8) 100%)`,
          clipPath: isMobile 
            ? "polygon(0 75%, 10% 60%, 20% 70%, 30% 50%, 40% 62%, 50% 40%, 60% 55%, 70% 35%, 80% 50%, 90% 60%, 100% 50%, 100% 100%, 0 100%)"
            : "polygon(0 70%, 8% 55%, 15% 62%, 22% 45%, 28% 52%, 32% 35%, 38% 48%, 45% 30%, 52% 42%, 58% 28%, 65% 38%, 72% 25%, 78% 35%, 82% 20%, 88% 32%, 95% 45%, 100% 55%, 100% 100%, 0 100%)",
          filter: "blur(1px)",
        }}
      />

      {/* Mid-ground rocky terrain */}
      <div 
        className="absolute bottom-0 left-0 right-0 transition-all duration-500"
        style={{ 
          height: "28%",
          background: `linear-gradient(to bottom, 
            rgb(${140 * lighting + 35}, ${75 * lighting + 20}, ${45 * lighting + 12}) 0%,
            rgb(${130 * lighting + 30}, ${68 * lighting + 18}, ${40 * lighting + 10}) 30%,
            rgb(${120 * lighting + 25}, ${60 * lighting + 15}, ${35 * lighting + 8}) 60%,
            rgb(${100 * lighting + 20}, ${50 * lighting + 12}, ${30 * lighting + 6}) 100%)`,
          clipPath: "polygon(0 50%, 3% 42%, 8% 48%, 12% 38%, 18% 45%, 25% 35%, 30% 42%, 38% 32%, 45% 40%, 52% 30%, 58% 38%, 65% 28%, 70% 35%, 78% 42%, 85% 32%, 92% 40%, 100% 35%, 100% 100%, 0 100%)",
        }}
      />

      {/* Rocky texture overlay for mid-ground */}
      <div 
        className="absolute bottom-0 left-0 right-0 transition-opacity duration-500"
        style={{ 
          height: "28%",
          opacity: 0.3 * lighting + 0.1,
          background: `
            radial-gradient(ellipse 8px 6px at 10% 60%, rgba(80, 40, 20, 0.4) 0%, transparent 100%),
            radial-gradient(ellipse 12px 8px at 25% 75%, rgba(60, 30, 15, 0.3) 0%, transparent 100%),
            radial-gradient(ellipse 6px 5px at 40% 55%, rgba(90, 45, 25, 0.4) 0%, transparent 100%),
            radial-gradient(ellipse 15px 10px at 55% 70%, rgba(70, 35, 18, 0.3) 0%, transparent 100%),
            radial-gradient(ellipse 8px 6px at 70% 65%, rgba(85, 42, 22, 0.4) 0%, transparent 100%),
            radial-gradient(ellipse 10px 7px at 85% 58%, rgba(75, 38, 20, 0.3) 0%, transparent 100%),
            radial-gradient(ellipse 5px 4px at 95% 72%, rgba(65, 32, 16, 0.4) 0%, transparent 100%)
          `,
          clipPath: "polygon(0 50%, 3% 42%, 8% 48%, 12% 38%, 18% 45%, 25% 35%, 30% 42%, 38% 32%, 45% 40%, 52% 30%, 58% 38%, 65% 28%, 70% 35%, 78% 42%, 85% 32%, 92% 40%, 100% 35%, 100% 100%, 0 100%)",
        }}
      />

      {/* Foreground terrain with detailed rocks */}
      <div 
        className="absolute bottom-0 left-0 right-0 transition-all duration-500"
        style={{ 
          height: "18%",
          background: `linear-gradient(to bottom, 
            rgb(${110 * lighting + 25}, ${55 * lighting + 15}, ${30 * lighting + 8}) 0%,
            rgb(${95 * lighting + 20}, ${48 * lighting + 12}, ${26 * lighting + 6}) 40%,
            rgb(${80 * lighting + 15}, ${40 * lighting + 10}, ${22 * lighting + 5}) 70%,
            rgb(${65 * lighting + 10}, ${32 * lighting + 8}, ${18 * lighting + 4}) 100%)`,
          clipPath: "polygon(0 55%, 5% 48%, 10% 55%, 18% 42%, 25% 52%, 32% 45%, 40% 55%, 48% 40%, 55% 50%, 62% 42%, 70% 52%, 78% 38%, 85% 48%, 92% 42%, 100% 50%, 100% 100%, 0 100%)",
        }}
      />

      {/* Scattered rocks in foreground */}
      <div 
        className="absolute bottom-0 left-0 right-0"
        style={{ height: "12%" }}
      >
        {/* Large boulder left */}
        <div
          className="absolute transition-all duration-500"
          style={{
            bottom: "15%",
            left: "8%",
            width: isMobile ? "28px" : "45px",
            height: isMobile ? "18px" : "30px",
            background: `linear-gradient(145deg, 
              rgb(${100 * lighting + 30}, ${55 * lighting + 15}, ${35 * lighting + 10}) 0%,
              rgb(${70 * lighting + 20}, ${38 * lighting + 10}, ${22 * lighting + 6}) 100%)`,
            borderRadius: "40% 60% 50% 50% / 60% 40% 60% 40%",
            boxShadow: `
              3px 3px 8px rgba(0, 0, 0, ${0.4 * (1 - lighting) + 0.2}),
              inset -2px -2px 4px rgba(0, 0, 0, 0.3),
              inset 1px 1px 2px rgba(255, 200, 150, ${0.15 * lighting})
            `,
          }}
        />
        {/* Medium rock center-left */}
        <div
          className="absolute transition-all duration-500"
          style={{
            bottom: "8%",
            left: "22%",
            width: isMobile ? "16px" : "25px",
            height: isMobile ? "11px" : "18px",
            background: `linear-gradient(135deg, 
              rgb(${90 * lighting + 25}, ${50 * lighting + 12}, ${30 * lighting + 8}) 0%,
              rgb(${60 * lighting + 15}, ${32 * lighting + 8}, ${18 * lighting + 5}) 100%)`,
            borderRadius: "50% 50% 45% 55% / 55% 45% 55% 45%",
            boxShadow: `2px 2px 5px rgba(0, 0, 0, ${0.3 * (1 - lighting) + 0.15})`,
          }}
        />
        {/* Small rock - hidden on mobile */}
        {!isMobile && (
          <div
            className="absolute transition-all duration-500"
            style={{
              bottom: "5%",
              left: "35%",
              width: "12px",
              height: "9px",
              background: `linear-gradient(140deg, 
                rgb(${85 * lighting + 20}, ${45 * lighting + 10}, ${28 * lighting + 6}) 0%,
                rgb(${55 * lighting + 12}, ${28 * lighting + 6}, ${16 * lighting + 4}) 100%)`,
              borderRadius: "45% 55% 50% 50%",
              boxShadow: `1px 1px 3px rgba(0, 0, 0, ${0.25 * (1 - lighting) + 0.1})`,
            }}
          />
        )}
        {/* Large boulder right */}
        <div
          className="absolute transition-all duration-500"
          style={{
            bottom: "12%",
            right: "12%",
            width: isMobile ? "35px" : "55px",
            height: isMobile ? "22px" : "35px",
            background: `linear-gradient(150deg, 
              rgb(${95 * lighting + 28}, ${52 * lighting + 14}, ${32 * lighting + 9}) 0%,
              rgb(${65 * lighting + 18}, ${35 * lighting + 9}, ${20 * lighting + 5}) 100%)`,
            borderRadius: "55% 45% 50% 50% / 50% 55% 45% 55%",
            boxShadow: `
              4px 4px 10px rgba(0, 0, 0, ${0.45 * (1 - lighting) + 0.2}),
              inset -3px -3px 6px rgba(0, 0, 0, 0.35),
              inset 2px 2px 3px rgba(255, 200, 150, ${0.12 * lighting})
            `,
          }}
        />
        {/* Medium rock right - hidden on mobile */}
        {!isMobile && (
          <div
            className="absolute transition-all duration-500"
            style={{
              bottom: "4%",
              right: "28%",
              width: "20px",
              height: "14px",
              background: `linear-gradient(130deg, 
                rgb(${88 * lighting + 22}, ${48 * lighting + 11}, ${29 * lighting + 7}) 0%,
                rgb(${58 * lighting + 14}, ${30 * lighting + 7}, ${17 * lighting + 4}) 100%)`,
              borderRadius: "48% 52% 50% 50%",
              boxShadow: `2px 2px 4px rgba(0, 0, 0, ${0.28 * (1 - lighting) + 0.12})`,
            }}
          />
        )}
      </div>

      {/* Dust particles (subtle) */}
      <div 
        className="absolute inset-0 transition-opacity duration-700"
        style={{ 
          opacity: 0.15 * lighting + 0.05,
          background: `
            radial-gradient(1px 1px at 15% 70%, rgba(200, 150, 100, 0.5), transparent),
            radial-gradient(1px 1px at 35% 65%, rgba(180, 130, 90, 0.4), transparent),
            radial-gradient(1.5px 1.5px at 50% 72%, rgba(190, 140, 95, 0.5), transparent),
            radial-gradient(1px 1px at 68% 68%, rgba(175, 125, 85, 0.4), transparent),
            radial-gradient(1px 1px at 82% 75%, rgba(185, 135, 92, 0.5), transparent),
            radial-gradient(1px 1px at 25% 78%, rgba(195, 145, 98, 0.4), transparent),
            radial-gradient(1.5px 1.5px at 60% 80%, rgba(170, 120, 82, 0.5), transparent),
            radial-gradient(1px 1px at 90% 70%, rgba(188, 138, 94, 0.4), transparent)
          `,
        }}
      />
    </div>
  );
};

export default MarsBackground;
