import { createContext } from "react";

export interface EasterEggContextType {
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  hideUI: boolean; // Hides settings form during animation
  setHideUI: (hide: boolean) => void;
}

export const EasterEggContext = createContext<EasterEggContextType | undefined>(undefined);
