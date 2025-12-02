import React, { useState, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import MarsFirmament from "@/components/shared/MarsFirmament";

/**
 * Mars Cliff Background Component - "Guido's Secret Chill Spot"
 * 
 * Displays the Valles Marineris cliff view with the shared Mars firmament.
 * The canyon and cliffs adapt their lighting based on the theme blend.
 * Responsive design adapts to mobile viewports.
 */
const MarsCliffBackground: React.FC = () => {
  const { themeBlend } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Lighting factor for terrain (1 = bright day, 0.08 = night minimum)
  const lighting = Math.max(0.08, 1 - (themeBlend / 100) * 1.1);

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -1 }}
    >
      {/* Shared Mars sky with sun, moons, stars */}
      <MarsFirmament starFieldHeight={55} />
      
      {/* Far canyon wall - left side (more lit by sun) */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          left: 0,
          top: isMobile ? "48%" : "42%",
          width: isMobile ? "35%" : "40%",
          height: isMobile ? "52%" : "58%",
          background: `linear-gradient(to right, 
            rgb(${55 * lighting + 12}, ${32 * lighting + 6}, ${25 * lighting + 5}) 0%, 
            rgb(${40 * lighting + 8}, ${22 * lighting + 4}, ${16 * lighting + 3}) 40%, 
            rgb(${22 * lighting + 4}, ${12 * lighting + 2}, ${9 * lighting + 1}) 70%,
            rgb(${10 * lighting + 2}, ${5 * lighting + 1}, ${5 * lighting + 1}) 100%)`,
          clipPath: isMobile ? "polygon(0 0, 100% 40%, 100% 100%, 0 100%)" : "polygon(0 0, 100% 45%, 100% 100%, 0 100%)",
          opacity: 0.9,
          filter: "blur(1px)",
        }}
      />

      {/* Far canyon wall - right side (in shadow) */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          right: 0,
          top: isMobile ? "48%" : "42%",
          width: isMobile ? "35%" : "40%",
          height: isMobile ? "52%" : "58%",
          background: `linear-gradient(to left, 
            rgb(${35 * lighting + 6}, ${20 * lighting + 3}, ${16 * lighting + 2}) 0%, 
            rgb(${22 * lighting + 3}, ${12 * lighting + 2}, ${9 * lighting + 1}) 35%,
            rgb(${12 * lighting + 2}, ${7 * lighting + 1}, ${6 * lighting}) 60%, 
            rgb(${6 * lighting + 1}, ${3 * lighting}, ${3 * lighting}) 100%)`,
          clipPath: isMobile ? "polygon(100% 0, 0 40%, 0 100%, 100% 100%)" : "polygon(100% 0, 0 45%, 0 100%, 100% 100%)",
          opacity: 0.9,
          filter: "blur(1px)",
        }}
      />

      {/* Canyon upper edge - lit by sun from left */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          left: isMobile ? "22%" : "28%",
          right: isMobile ? "22%" : "28%",
          top: isMobile ? "62%" : "58%",
          height: isMobile ? "10%" : "12%",
          background: `linear-gradient(to bottom, 
            rgba(${85 * lighting + 15}, ${50 * lighting + 8}, ${35 * lighting + 5}, 0.9) 0%,
            rgba(${45 * lighting + 8}, ${25 * lighting + 4}, ${18 * lighting + 3}, 0.95) 40%,
            rgba(${20 * lighting + 3}, ${12 * lighting + 2}, ${10 * lighting + 1}, 1) 100%)`,
          clipPath: "polygon(5% 0, 95% 0, 88% 100%, 12% 100%)",
        }}
      />

      {/* Canyon left wall - more lit by sun */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          left: isMobile ? "22%" : "28%",
          width: isMobile ? "18%" : "14%",
          top: isMobile ? "62%" : "58%",
          bottom: 0,
          background: `linear-gradient(135deg, 
            rgba(${70 * lighting + 10}, ${40 * lighting + 6}, ${28 * lighting + 4}, 0.85) 0%,
            rgba(${35 * lighting + 5}, ${20 * lighting + 3}, ${14 * lighting + 2}, 0.9) 30%,
            rgba(${12 * lighting + 2}, ${7 * lighting + 1}, ${6 * lighting + 1}, 0.95) 60%,
            rgba(0, 0, 0, 1) 100%)`,
          clipPath: "polygon(5% 0, 100% 12%, 75% 100%, 12% 100%)",
        }}
      />

      {/* Canyon right wall - in shadow */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          right: isMobile ? "22%" : "28%",
          width: isMobile ? "18%" : "14%",
          top: isMobile ? "62%" : "58%",
          bottom: 0,
          background: `linear-gradient(225deg, 
            rgba(${40 * lighting + 5}, ${22 * lighting + 3}, ${16 * lighting + 2}, 0.85) 0%,
            rgba(${18 * lighting + 2}, ${10 * lighting + 1}, ${8 * lighting + 1}, 0.92) 25%,
            rgba(${6 * lighting + 1}, ${3 * lighting}, ${3 * lighting}, 0.97) 50%,
            rgba(0, 0, 0, 1) 100%)`,
          clipPath: "polygon(0% 12%, 95% 0, 88% 100%, 25% 100%)",
        }}
      />

      {/* The abyss - deep canyon center */}
      <div 
        className="absolute"
        style={{
          left: isMobile ? "32%" : "35%",
          right: isMobile ? "32%" : "35%",
          top: isMobile ? "68%" : "65%",
          bottom: 0,
          background: `linear-gradient(to bottom, 
            rgba(${5 * lighting + 1}, ${3 * lighting}, ${3 * lighting}, 1) 0%, 
            #020101 20%, 
            #010101 50%, 
            #000000 100%)`,
          clipPath: "polygon(0 0, 100% 0, 80% 100%, 20% 100%)",
        }}
      />

      {/* Canyon depth layers - subtle depth indication */}
      <div 
        className="absolute"
        style={{
          left: isMobile ? "33%" : "36%",
          right: isMobile ? "33%" : "36%",
          top: isMobile ? "72%" : "70%",
          height: isMobile ? "12%" : "15%",
          background: `linear-gradient(to bottom, 
            rgba(${35 * lighting + 3}, ${18 * lighting + 2}, ${12 * lighting + 1}, 0.25) 0%, 
            transparent 100%)`,
          clipPath: "polygon(8% 0, 92% 0, 78% 100%, 22% 100%)",
        }}
      />

      {/* Canyon mist - rising from depths */}
      <div 
        className="absolute"
        style={{
          left: isMobile ? "25%" : "30%",
          right: isMobile ? "25%" : "30%",
          top: isMobile ? "75%" : "72%",
          bottom: isMobile ? "8%" : "5%",
          background: `radial-gradient(ellipse 100% 70% at 50% 90%, 
            rgba(${120 * lighting + 8}, ${65 * lighting + 4}, ${40 * lighting + 3}, 0.12) 0%, 
            transparent 65%)`,
          filter: isMobile ? "blur(10px)" : "blur(15px)",
        }}
      />

      {/* LEFT CLIFF EDGE */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          left: 0,
          bottom: 0,
          width: isMobile ? "42%" : "36%",
          height: isMobile ? "45%" : "52%",
          background: `linear-gradient(135deg, 
            rgb(${85 * lighting + 5}, ${50 * lighting + 3}, ${36 * lighting + 2}) 0%, 
            rgb(${70 * lighting + 4}, ${38 * lighting + 2}, ${30 * lighting + 2}) 30%, 
            rgb(${58 * lighting + 3}, ${30 * lighting + 2}, ${23 * lighting + 1}) 60%, 
            rgb(${42 * lighting + 2}, ${20 * lighting + 1}, ${15 * lighting + 1}) 100%)`,
          clipPath: isMobile ? "polygon(0 25%, 58% 38%, 100% 100%, 0 100%)" : "polygon(0 22%, 62% 36%, 100% 100%, 0 100%)",
          boxShadow: `inset 0 10px 40px rgba(${85 * lighting + 5}, ${45 * lighting + 3}, ${30 * lighting + 2}, 0.4)`,
        }}
      />
      
      {/* Left cliff rim highlight */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          left: 0,
          bottom: isMobile ? "28%" : "36%",
          width: isMobile ? "40%" : "34%",
          height: isMobile ? "6%" : "8%",
          background: `linear-gradient(to bottom, 
            rgba(255, ${180 * lighting + 40}, ${100 * lighting + 20}, ${0.25 * lighting + 0.05}) 0%, 
            transparent 100%)`,
          clipPath: "polygon(0 50%, 100% 0, 100% 100%, 0 100%)",
          filter: "blur(2px)",
        }}
      />

      {/* RIGHT CLIFF EDGE */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          right: 0,
          bottom: 0,
          width: isMobile ? "42%" : "36%",
          height: isMobile ? "45%" : "52%",
          background: `linear-gradient(225deg, 
            rgb(${70 * lighting + 4}, ${38 * lighting + 2}, ${30 * lighting + 2}) 0%, 
            rgb(${58 * lighting + 3}, ${30 * lighting + 2}, ${23 * lighting + 1}) 30%, 
            rgb(${42 * lighting + 2}, ${20 * lighting + 1}, ${15 * lighting + 1}) 60%, 
            rgb(${25 * lighting + 1}, ${10 * lighting + 1}, ${8 * lighting}) 100%)`,
          clipPath: isMobile ? "polygon(100% 25%, 42% 38%, 0 100%, 100% 100%)" : "polygon(100% 22%, 38% 36%, 0 100%, 100% 100%)",
          boxShadow: `inset 0 10px 40px rgba(${65 * lighting + 4}, ${35 * lighting + 2}, ${25 * lighting + 2}, 0.3)`,
        }}
      />

      {/* Right cliff shadow overlay */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          right: 0,
          bottom: 0,
          width: isMobile ? "42%" : "36%",
          height: isMobile ? "45%" : "52%",
          background: `linear-gradient(to left, 
            rgba(0, 0, 0, ${0.4 - lighting * 0.2}) 0%, 
            transparent 60%)`,
          clipPath: isMobile ? "polygon(100% 25%, 42% 38%, 0 100%, 100% 100%)" : "polygon(100% 22%, 38% 36%, 0 100%, 100% 100%)",
        }}
      />

      {/* Rocks on left cliff */}
      <div 
        className="absolute transition-all duration-700"
        style={{
          left: "8%",
          bottom: isMobile ? "18%" : "24%",
          width: isMobile ? "35px" : "55px",
          height: isMobile ? "20px" : "32px",
          background: `linear-gradient(145deg, 
            rgb(${100 * lighting + 6}, ${55 * lighting + 3}, ${45 * lighting + 3}) 0%, 
            rgb(${85 * lighting + 5}, ${45 * lighting + 3}, ${36 * lighting + 2}) 30%, 
            rgb(${58 * lighting + 3}, ${30 * lighting + 2}, ${22 * lighting + 1}) 100%)`,
          borderRadius: "40% 60% 30% 70%",
          transform: "rotate(-8deg)",
          boxShadow: `
            inset 3px 3px 8px rgba(${95 * lighting + 5}, ${55 * lighting + 3}, ${38 * lighting + 2}, 0.4),
            inset -4px -4px 10px rgba(0, 0, 0, 0.5),
            5px 5px 15px rgba(0, 0, 0, 0.4)
          `,
        }}
      />
      <div 
        className="absolute transition-all duration-700"
        style={{
          left: "18%",
          bottom: isMobile ? "14%" : "19%",
          width: isMobile ? "24px" : "38px",
          height: isMobile ? "13px" : "20px",
          background: `linear-gradient(135deg, 
            rgb(${85 * lighting + 5}, ${45 * lighting + 3}, ${36 * lighting + 2}) 0%, 
            rgb(${70 * lighting + 4}, ${38 * lighting + 2}, ${30 * lighting + 2}) 40%, 
            rgb(${42 * lighting + 2}, ${20 * lighting + 1}, ${15 * lighting + 1}) 100%)`,
          borderRadius: "50% 50% 40% 60%",
          boxShadow: `
            inset 2px 2px 6px rgba(${85 * lighting + 5}, ${48 * lighting + 3}, ${33 * lighting + 2}, 0.3),
            inset -3px -3px 8px rgba(0, 0, 0, 0.4),
            4px 4px 12px rgba(0, 0, 0, 0.35)
          `,
        }}
      />

      {/* Small pebble near edge - hidden on mobile for simplicity */}
      {!isMobile && (
        <div 
          className="absolute transition-all duration-700"
          style={{
            left: "26%",
            bottom: "31%",
            width: "14px",
            height: "9px",
            background: `linear-gradient(135deg, 
              rgb(${70 * lighting + 4}, ${38 * lighting + 2}, ${30 * lighting + 2}) 0%, 
              rgb(${42 * lighting + 2}, ${20 * lighting + 1}, ${15 * lighting + 1}) 100%)`,
            borderRadius: "50%",
            boxShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)",
          }}
        />
      )}

      {/* Atmospheric haze */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: `linear-gradient(to bottom, 
            transparent 0%, 
            transparent 50%, 
            rgba(${95 * lighting + 5}, ${55 * lighting + 5}, ${38 * lighting + 2}, 0.08) 70%, 
            rgba(${75 * lighting + 4}, ${38 * lighting + 2}, ${28 * lighting + 2}, 0.12) 100%)`,
        }}
      />

      {/* Dust particles in air */}
      <div 
        className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
        style={{ 
          opacity: 0.12 * lighting + 0.03,
          background: `
            radial-gradient(1px 1px at 12% 55%, rgba(200, 150, 100, 0.5), transparent),
            radial-gradient(1.5px 1.5px at 28% 48%, rgba(180, 130, 90, 0.4), transparent),
            radial-gradient(1px 1px at 45% 52%, rgba(190, 140, 95, 0.5), transparent),
            radial-gradient(1px 1px at 62% 45%, rgba(175, 125, 85, 0.4), transparent),
            radial-gradient(1.5px 1.5px at 78% 50%, rgba(185, 135, 92, 0.5), transparent),
            radial-gradient(1px 1px at 88% 58%, rgba(195, 145, 98, 0.4), transparent)
          `,
        }}
      />
    </div>
  );
};

export default MarsCliffBackground;
