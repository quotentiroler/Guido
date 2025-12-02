import { createContext } from "react";

export interface AppContextType {
  isExpertMode: boolean;
  setIsExpertMode: (value: boolean) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
