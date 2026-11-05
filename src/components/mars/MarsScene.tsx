import React from "react";
import { useTheme } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/useIsMobile";
import MarsFirmament from "@/components/mars/MarsFirmament";

export interface MarsTerrain {
  lighting: number;
  isMobile: boolean;
}

interface MarsSceneProps {
  starFieldHeight: number;
  children: (terrain: MarsTerrain) => React.ReactNode;
}

const MarsScene: React.FC<MarsSceneProps> = ({ starFieldHeight, children }) => {
  const { themeBlend } = useTheme();
  const isMobile = useIsMobile();
  const lighting = Math.max(0.08, 1 - (themeBlend / 100) * 1.1);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -1 }}
    >
      <MarsFirmament starFieldHeight={starFieldHeight} />
      {children({ lighting, isMobile })}
    </div>
  );
};

export default MarsScene;
