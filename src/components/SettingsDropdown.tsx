import React, { useState, useRef, useEffect } from "react";
import localforage from "localforage";
import { useTheme } from "@/hooks/useTheme";
import { useAlert } from "@/hooks/useAlert";
import GearIcon from "@/assets/svg/gear.svg";

const MENU_ITEM_CLASS = "w-full px-4 py-2 text-left text-base text-text-secondary hover:bg-surface-hover flex items-center";

interface BackgroundOptionProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

const BackgroundOption: React.FC<BackgroundOptionProps> = ({ icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between text-sm text-text-secondary hover:text-text-primary"
  >
    <span className="flex items-center gap-2">
      <span>{icon}</span>
      <span>{label}</span>
    </span>
    <span className={`text-sm ${active ? 'text-success-700' : 'text-text-disabled'}`}>
      {active ? '✓' : ''}
    </span>
  </button>
);

interface SettingsDropdownProps {
  onOpenRegistries: () => void;
  isExpertMode: boolean;
  onToggleExpertMode: () => void;
  onOpenAISetup: () => void;
  onOpenChatHistory: () => void;
}

const SettingsDropdown: React.FC<SettingsDropdownProps> = ({ 
  onOpenRegistries,
  isExpertMode,
  onToggleExpertMode,
  onOpenAISetup,
  onOpenChatHistory,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const animationRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { themeBlend, setThemeBlend, marsBackground, setMarsBackground, secretSpaceMode, setSecretSpaceMode } = useTheme();
  const { alert, confirm } = useAlert();

  const closeMenu = () => {
    setIsOpen(false);
    setShowThemeSubmenu(false);
  };

  const openFromMenu = (open: () => void) => () => {
    closeMenu();
    open();
  };

  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsAnimating(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && event.target instanceof Node && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowThemeSubmenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startAnimation = () => {
    if (isAnimating) {
      stopAnimation();
      return;
    }

    const goingForward = themeBlend < 50;
    const targetValue = goingForward ? 100 : 0;
    
    // Don't animate if already at target
    if (themeBlend === targetValue) {
      return;
    }

    setIsAnimating(true);
    const startTime = Date.now();
    const duration = 8000; // 8 seconds for full cycle
    const startValue = themeBlend;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth easing
      const eased = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      const currentValue = startValue + (targetValue - startValue) * eased;
      setThemeBlend(Math.round(currentValue));
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        animationRef.current = null;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };

  const handleBlendChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (animationRef.current) {
      stopAnimation();
    }
    setThemeBlend(parseInt(e.target.value, 10));
  };

  const getBlendLabel = () => {
    if (themeBlend <= 25) return "Light";
    if (themeBlend <= 50) return "Light+ 💎";
    if (themeBlend <= 75) return "Dark+ 💎";
    return "Dark";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Settings Button (Gear Icon) */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setShowThemeSubmenu(false);
        }}
        className="w-6 h-6 flex items-center justify-center text-text-secondary hover:text-gray-900 dark:hover:text-white transition-colors"
        aria-label="Settings"
        title="Settings"
      >
        <img src={GearIcon} alt="Settings" className="w-5 h-5 dark:invert" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-surface-0 rounded-lg shadow-lg border py-1 z-50">
          {/* Expert Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              onToggleExpertMode();
            }}
            className={`${MENU_ITEM_CLASS} justify-between`}
          >
            <span className="flex items-center gap-2">
              <span>🔧</span>
              <span>Expert Mode</span>
            </span>
            <span className={`text-sm ${isExpertMode ? 'text-success-700' : 'text-text-disabled'}`}>
              {isExpertMode ? '✓ On' : 'Off'}
            </span>
          </button>

          {/* Registries Option - Only visible in Expert Mode */}
          {isExpertMode && (
            <button
              type="button"
              onClick={openFromMenu(onOpenRegistries)}
              className={`${MENU_ITEM_CLASS} gap-2`}
            >
              <span>📦</span>
              <span>Registries</span>
            </button>
          )}

          {/* AI Setup - Only visible in Secret Space Mode */}
          {secretSpaceMode && (
            <>
              {/* Divider */}
              <div className="my-1 border-t border-border" />

              <button
                type="button"
                onClick={openFromMenu(onOpenAISetup)}
                className={`${MENU_ITEM_CLASS} gap-2`}
              >
                <span>🤖</span>
                <span>AI Setup</span>
              </button>
            </>
          )}

          {/* Chat History */}
          <button
            type="button"
            onClick={openFromMenu(onOpenChatHistory)}
            className={`${MENU_ITEM_CLASS} gap-2`}
          >
            <span>💬</span>
            <span>Chat History</span>
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-border" />

          {/* Clear All Data */}
          <button
            type="button"
            onClick={() => {
              if (isClearing) return;
              
              // Confirm before clearing using fancy confirm
              confirm(
                'Are you sure you want to clear all local data? This will remove your template, settings, AI configuration, and preferences. This cannot be undone.',
                () => {
                  setIsClearing(true);
                  localforage.clear()
                    .then(() => {
                      alert('All local data has been cleared. Refreshing...');
                      // Reload the page after a short delay to apply changes
                      setTimeout(() => {
                        window.location.reload();
                      }, 500);
                    })
                    .catch((error: unknown) => {
                      console.error('Failed to clear data:', error);
                      alert('Failed to clear data');
                    })
                    .finally(() => {
                      setIsClearing(false);
                    });
                }
              );
            }}
            disabled={isClearing}
            className="w-full px-4 py-2 text-left text-base text-error-600 hover:bg-error-100 dark:hover:bg-error-800/20 flex items-center gap-2 disabled:opacity-50"
          >
            <span>🗑️</span>
            <span>{isClearing ? 'Clearing...' : 'Clear All Data'}</span>
          </button>

          {/* Theme Option with Submenu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowThemeSubmenu(!showThemeSubmenu)}
              className={`${MENU_ITEM_CLASS} justify-between`}
            >
              <span className="flex items-center gap-2">
                <span>🎨</span>
                <span>Theme</span>
              </span>
              <span className="text-sm">{showThemeSubmenu ? "▼" : "▶"}</span>
            </button>

            {/* Theme Submenu */}
            {showThemeSubmenu && (
              <div className="border-t border bg-surface-2 px-4 py-3">
                {/* Theme Slider with Play Button */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">☀️</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={startAnimation}
                        className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                          isAnimating 
                            ? 'bg-vibrant-blue text-white' 
                            : 'bg-surface-3 text-text-secondary hover:bg-surface-4'
                        }`}
                        title={isAnimating ? 'Stop animation' : (themeBlend < 50 ? 'Play day → night' : 'Play night → day')}
                      >
                        {isAnimating ? '⏹' : '▶'}
                      </button>
                      <span className="text-sm text-text-secondary font-medium">{getBlendLabel()}</span>
                    </div>
                    <span className="text-lg">🌙</span>
                  </div>
                  <input
                    id="theme-blend"
                    name="theme-blend"
                    type="range"
                    min="0"
                    max="100"
                    value={themeBlend}
                    onChange={handleBlendChange}
                    disabled={isAnimating}
                    aria-label="Theme blend between light and dark"
                    className={`w-full h-2 bg-surface-4 rounded-lg appearance-none cursor-pointer accent-vibrant-blue ${isAnimating ? 'opacity-50' : ''}`}
                    style={{
                      background: `linear-gradient(to right, #FFFFFF 0%, #E3F8FC 25%, #3AB0DB 50%, #194960 75%, #171F2B 100%)`
                    }}
                  />
                </div>

                {/* Mars Background Controls */}
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {secretSpaceMode && (
                    <BackgroundOption icon="🏜️" label="Guido's Chill Spot" active onClick={() => undefined} />
                  )}
                  <BackgroundOption
                    icon="🔴"
                    label="Mars Plains"
                    active={!secretSpaceMode && marsBackground}
                    onClick={() => {
                      setSecretSpaceMode(false);
                      setMarsBackground(true);
                    }}
                  />
                  <BackgroundOption
                    icon="🚫"
                    label="No Background"
                    active={!secretSpaceMode && !marsBackground}
                    onClick={() => {
                      setSecretSpaceMode(false);
                      setMarsBackground(false);
                    }}
                  />

                  <p className="text-xs text-text-disabled pl-6">
                    {secretSpaceMode ? 'You found Guido\'s secret spot! 🤖' : 'Disable for better performance'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsDropdown;
