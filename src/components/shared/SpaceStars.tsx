import React, { useMemo } from "react";

interface Star {
  width: number;
  height: number;
  left: number;
  top: number;
  opacity: number;
  duration: number;
  delay: number;
}

interface SpaceStarsProps {
  /** Number of stars to render */
  count?: number;
  /** Custom className for the container */
  className?: string;
}

// Generate stars outside of render cycle
const generateStars = (count: number): Star[] => {
  return Array.from({ length: count }, () => ({
    width: Math.random() * 3 + 1,
    height: Math.random() * 3 + 1,
    left: Math.random() * 100,
    top: Math.random() * 100,
    opacity: Math.random() * 0.8 + 0.2,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  }));
};

/**
 * SpaceStars Component
 * 
 * Renders a starfield with twinkling animation.
 * Stars are pre-generated using useMemo to comply with React's pure function requirements.
 */
const SpaceStars: React.FC<SpaceStarsProps> = ({ count = 80, className = "" }) => {
  // Pre-generate stars to avoid Math.random() during render
  const stars = useMemo(() => generateStars(count), [count]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: star.width + "px",
            height: star.height + "px",
            left: star.left + "%",
            top: star.top + "%",
            opacity: star.opacity,
            animation: `twinkle ${star.duration}s ease-in-out infinite`,
            animationDelay: star.delay + "s",
          }}
        />
      ))}
    </div>
  );
};

export default SpaceStars;
