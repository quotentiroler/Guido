import { createContext } from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeBlend: number; // 0 = light, 100 = dark
  setThemeBlend: (blend: number) => void;
  marsBackground: boolean;
  setMarsBackground: (enabled: boolean) => void;
  secretSpaceMode: boolean;
  setSecretSpaceMode: (enabled: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
