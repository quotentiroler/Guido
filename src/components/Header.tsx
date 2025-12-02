import React, { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo.png";
import secretLogo from "@/assets/guido_logo.png";
import SettingsDropdown from "@/components/SettingsDropdown";
import RegistrySettingsModal from "@/components/RegistrySettingsModal";
import AISetupModal from "@/components/AISetupModal";
import ChatHistoryModal from "@/components/ChatHistoryModal";
import { useAlert } from "@/hooks/useAlert";
import { useAppContext } from "@/hooks/useAppContext";
import { useTheme } from "@/hooks/useTheme";
import ArrowUpIcon from "@/assets/svg/arrow-up-icon.svg";

interface HeaderProps {
  readmeContent: string;
}

const Header: React.FC<HeaderProps> = ({ readmeContent }) => {
  const { alert } = useAlert();
  const { isExpertMode, setIsExpertMode } = useAppContext();
  const { secretSpaceMode } = useTheme();
  const [showArrow, setShowArrow] = useState(false);
  const [showRegistryModal, setShowRegistryModal] = useState(false);
  const [showAISetupModal, setShowAISetupModal] = useState(false);
  const [showChatHistoryModal, setShowChatHistoryModal] = useState(false);
  const [showLogoHint, setShowLogoHint] = useState(false);
  const logoHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggleExpertMode = () => {
    setIsExpertMode(!isExpertMode);
  };

  const handleLogoMouseEnter = () => {
    logoHoverTimer.current = setTimeout(() => {
      setShowLogoHint(true);
    }, 900);
  };

  const handleLogoMouseLeave = () => {
    if (logoHoverTimer.current) {
      clearTimeout(logoHoverTimer.current);
      logoHoverTimer.current = null;
    }
    setShowLogoHint(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowArrow(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="sticky top-0 z-50 mb-8 border-b border-gray-500 py-2 bg-surface-0/90 backdrop-blur-sm transition-all duration-300 blend-glass">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 relative">
          <div 
            className="relative"
            onMouseEnter={handleLogoMouseEnter}
            onMouseLeave={handleLogoMouseLeave}
          >
            <a
              href="https://"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img src={secretSpaceMode ? secretLogo : logo} className="h-8 sm:h-10 lg:h-12 logo" alt="logo" />
            </a>
            {showLogoHint && (
              <div className="absolute top-full left-0 mt-1 bg-surface-1 border border-strong rounded px-2 py-1 text-xs text-text-secondary whitespace-nowrap shadow-lg animate-fade-in z-50">
                💡 Try clicking "Guido"
              </div>
            )}
          </div>
          <div className="flex flex-row items-center gap-4 sm:gap-6 lg:gap-8">
            <button
              type="button"
              className="w-6 h-6 flex items-center justify-center border border-strong rounded-full text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              onClick={() =>
                alert(
                  readmeContent ?? "Grab your towel firmly and brace for impact!"
                )
              }
            >
              ?
            </button>
            <SettingsDropdown 
              onOpenRegistries={() => setShowRegistryModal(true)}
              isExpertMode={isExpertMode}
              onToggleExpertMode={handleToggleExpertMode}
              onOpenAISetup={() => setShowAISetupModal(true)}
              onOpenChatHistory={() => setShowChatHistoryModal(true)}
            />
          </div>
          {showArrow && (
            <div
              className="absolute left-1/2 transform -translate-x-1/2 cursor-pointer"
              onClick={scrollToTop}
            >
              <img src={ArrowUpIcon} alt="Clear" className="h-8 w-8 dark:invert" />
            </div>
          )}
        </div>
      </div>

      {showRegistryModal && (
        <RegistrySettingsModal onClose={() => setShowRegistryModal(false)} />
      )}

      {showAISetupModal && (
        <AISetupModal onClose={() => setShowAISetupModal(false)} />
      )}

      {showChatHistoryModal && (
        <ChatHistoryModal onClose={() => setShowChatHistoryModal(false)} />
      )}
    </>
  );
};

export default Header;