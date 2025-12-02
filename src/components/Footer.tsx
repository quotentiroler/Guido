import React, { useState } from "react";
import { useTheme } from "@/hooks/useTheme";

declare const __APP_VERSION__: string;

const Footer: React.FC = () => {
  const version = __APP_VERSION__;
  const buildTimestamp = (import.meta.env.VITE_BUILD_TIMESTAMP as string | undefined) ?? "development";
  const { setSecretSpaceMode } = useTheme();
  const [clickCount, setClickCount] = useState(0);

  const handleSecretClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    // Activate secret mode after 5 clicks on "Guido" (without animation)
    if (newCount >= 5) {
      setSecretSpaceMode(true);
      setClickCount(0);
    }
    
    // Reset count after 2 seconds of no clicks
    setTimeout(() => {
      setClickCount((prev) => (prev === newCount ? 0 : prev));
    }, 2000);
  };

  return (
    <footer className="mt-auto border-t border-gray-500 py-4 bg-surface-0/90 backdrop-blur-sm transition-all duration-300 blend-glass">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-text-secondary">
          <div className="flex items-center gap-2">
            <span 
              onClick={handleSecretClick}
              className="cursor-default select-none transition-all duration-300 hover:text-vibrant-blue hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"
              title={clickCount > 0 ? `${5 - clickCount} more...` : undefined}
            >
              Guido
            </span>
            <span className="text-text-tertiary">
              v{version}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-text-tertiary text-xs">
              {buildTimestamp !== "development" 
                ? `Built: ${buildTimestamp}` 
                : "Development Build"}
            </span>
            <a
              href="https://github.com/quotentiroler/Guido"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/quotentiroler/quotentiroler"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              QuotenTiroler
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
