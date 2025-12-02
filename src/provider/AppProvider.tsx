import React, { useState, useEffect, useCallback, useMemo } from "react";
import localforage from "localforage";
import { AppContext } from "@/context/AppContext";

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [isExpertMode, setIsExpertModeState] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load initial value from localforage
  useEffect(() => {
    const loadExpertMode = async () => {
      try {
        const stored = await localforage.getItem<boolean>("expertMode");
        if (stored !== null) {
          setIsExpertModeState(stored);
        }
      } catch (e) {
        console.error("Failed to load expertMode from storage:", e);
      }
      setIsLoaded(true);
    };
    void loadExpertMode();
  }, []);

  // Save to localforage when value changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      void localforage.setItem("expertMode", isExpertMode);
    }
  }, [isExpertMode, isLoaded]);

  const setIsExpertMode = useCallback((value: boolean) => {
    setIsExpertModeState(value);
  }, []);

  const value = useMemo(() => ({
    isExpertMode,
    setIsExpertMode,
  }), [isExpertMode, setIsExpertMode]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
