import React, { useState, useCallback, ReactNode } from "react";
import { EasterEggContext } from "@/context/EasterEggContext";

interface EasterEggProviderProps {
  children: ReactNode;
}

export const EasterEggProvider: React.FC<EasterEggProviderProps> = ({ children }) => {
  const [isActive, setIsActiveState] = useState(false);
  const [hideUI, setHideUIState] = useState(false);

  const setIsActive = useCallback((active: boolean) => {
    setIsActiveState(active);
  }, []);

  const setHideUI = useCallback((hide: boolean) => {
    setHideUIState(hide);
  }, []);

  return (
    <EasterEggContext.Provider value={{ isActive, setIsActive, hideUI, setHideUI }}>
      {children}
    </EasterEggContext.Provider>
  );
};
