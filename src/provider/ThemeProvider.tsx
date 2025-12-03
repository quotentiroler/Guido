import React, { useState, useEffect, useCallback, ReactNode } from "react";
import localforage from "localforage";
import { Theme, ThemeContext } from "@/context/ThemeContext";

const STORAGE_KEY = "theme";
const BLEND_STORAGE_KEY = "theme-blend";
const MARS_BG_STORAGE_KEY = "mars-background";
const SECRET_SPACE_STORAGE_KEY = "secret-space-mode";

// Light+ zone colors (light blues) - starts with visible blue tint
const LIGHT_PLUS_COLORS = {
  surface0: ["#E8F7FC", "#CEEFF8"],  // Start with light blue tint
  surface1: ["#DCF2F9", "#B9E6F4"],
  surface2: ["#CEEFF8", "#A0D8EC"],
  surface3: ["#B9E6F4", "#8ACDE5"],
  surface4: ["#A0D8EC", "#6EC2DE"],
  surface5: ["#8ACDE5", "#5AB8D8"],
  border: ["#A0D8EC", "#6EC2DE"],
  borderStrong: ["#5AB8D8", "#3AB0DB"],
  hover: ["#CEEFF8", "#A0D8EC"],
  active: ["#B9E6F4", "#8ACDE5"],
};

// Dark+ zone colors (dark blues)
const DARK_PLUS_COLORS = {
  surface0: ["#3AB0DB", "#0f2a38"],
  surface1: ["#2A9BC5", "#133545"],
  surface2: ["#226280", "#194960"],
  surface3: ["#1d5570", "#1d5570"],
  surface4: ["#194960", "#226280"],
  surface5: ["#133545", "#2a7090"],
  border: ["#3AB0DB", "#1d5570"],
  borderStrong: ["#4ABAE0", "#226280"],
  hover: ["#226280", "#194960"],
  active: ["#1d5570", "#1d5570"],
};

function interpolateColor(color1: string, color2: string, ratio: number): string {
  const hex = (c: string) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7));
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function applyTheme(theme: Theme, blend: number) {
  const root = document.documentElement;
  
  // Clear all theme classes first
  root.classList.remove("dark", "blend-mode", "zone-light-plus", "zone-dark-plus");
  root.style.removeProperty("--theme-blend");
  
  // Calculate glass effect intensity - peaks at blend 50 (center of spectrum)
  // Uses a bell curve: 1 - |blend - 50| / 50, clamped to 0-1
  const glassIntensity = Math.max(0, 1 - Math.abs(blend - 50) / 50);
  // Boost the effect in the middle range (25-75)
  const boostedGlass = blend >= 25 && blend <= 75 ? Math.pow(glassIntensity, 0.5) : glassIntensity * 0.3;
  
  // Set glass effect CSS variables
  root.style.setProperty("--glass-opacity", `${0.85 - boostedGlass * 0.45}`); // 0.85 -> 0.4 at peak
  root.style.setProperty("--glass-blur", `${4 + boostedGlass * 16}px`); // 4px -> 20px at peak
  root.style.setProperty("--glass-saturation", `${100 + boostedGlass * 80}%`); // 100% -> 180% at peak
  
  // Zone 1: Pure Light (0-25)
  if (blend <= 25) {
    root.style.colorScheme = "light";
    // No special classes needed, uses default :root values
  }
  // Zone 2: Light+ with light blues (25-50)
  else if (blend <= 50) {
    const zoneRatio = (blend - 25) / 25; // 0-1 within this zone
    root.classList.add("blend-mode", "zone-light-plus");
    root.style.colorScheme = "light";
    
    // Set interpolated colors
    root.style.setProperty("--zone-surface-0", interpolateColor(LIGHT_PLUS_COLORS.surface0[0], LIGHT_PLUS_COLORS.surface0[1], zoneRatio));
    root.style.setProperty("--zone-surface-1", interpolateColor(LIGHT_PLUS_COLORS.surface1[0], LIGHT_PLUS_COLORS.surface1[1], zoneRatio));
    root.style.setProperty("--zone-surface-2", interpolateColor(LIGHT_PLUS_COLORS.surface2[0], LIGHT_PLUS_COLORS.surface2[1], zoneRatio));
    root.style.setProperty("--zone-surface-3", interpolateColor(LIGHT_PLUS_COLORS.surface3[0], LIGHT_PLUS_COLORS.surface3[1], zoneRatio));
    root.style.setProperty("--zone-surface-4", interpolateColor(LIGHT_PLUS_COLORS.surface4[0], LIGHT_PLUS_COLORS.surface4[1], zoneRatio));
    root.style.setProperty("--zone-surface-5", interpolateColor(LIGHT_PLUS_COLORS.surface5[0], LIGHT_PLUS_COLORS.surface5[1], zoneRatio));
    root.style.setProperty("--zone-border", interpolateColor(LIGHT_PLUS_COLORS.border[0], LIGHT_PLUS_COLORS.border[1], zoneRatio));
    root.style.setProperty("--zone-border-strong", interpolateColor(LIGHT_PLUS_COLORS.borderStrong[0], LIGHT_PLUS_COLORS.borderStrong[1], zoneRatio));
    root.style.setProperty("--zone-hover", interpolateColor(LIGHT_PLUS_COLORS.hover[0], LIGHT_PLUS_COLORS.hover[1], zoneRatio));
    root.style.setProperty("--zone-active", interpolateColor(LIGHT_PLUS_COLORS.active[0], LIGHT_PLUS_COLORS.active[1], zoneRatio));
  }
  // Zone 3: Dark+ with dark blues (50-75)
  else if (blend <= 75) {
    const zoneRatio = (blend - 50) / 25; // 0-1 within this zone
    root.classList.add("blend-mode", "zone-dark-plus");
    root.style.colorScheme = "dark";
    
    // Set interpolated colors
    root.style.setProperty("--zone-surface-0", interpolateColor(DARK_PLUS_COLORS.surface0[0], DARK_PLUS_COLORS.surface0[1], zoneRatio));
    root.style.setProperty("--zone-surface-1", interpolateColor(DARK_PLUS_COLORS.surface1[0], DARK_PLUS_COLORS.surface1[1], zoneRatio));
    root.style.setProperty("--zone-surface-2", interpolateColor(DARK_PLUS_COLORS.surface2[0], DARK_PLUS_COLORS.surface2[1], zoneRatio));
    root.style.setProperty("--zone-surface-3", interpolateColor(DARK_PLUS_COLORS.surface3[0], DARK_PLUS_COLORS.surface3[1], zoneRatio));
    root.style.setProperty("--zone-surface-4", interpolateColor(DARK_PLUS_COLORS.surface4[0], DARK_PLUS_COLORS.surface4[1], zoneRatio));
    root.style.setProperty("--zone-surface-5", interpolateColor(DARK_PLUS_COLORS.surface5[0], DARK_PLUS_COLORS.surface5[1], zoneRatio));
    root.style.setProperty("--zone-border", interpolateColor(DARK_PLUS_COLORS.border[0], DARK_PLUS_COLORS.border[1], zoneRatio));
    root.style.setProperty("--zone-border-strong", interpolateColor(DARK_PLUS_COLORS.borderStrong[0], DARK_PLUS_COLORS.borderStrong[1], zoneRatio));
    root.style.setProperty("--zone-hover", interpolateColor(DARK_PLUS_COLORS.hover[0], DARK_PLUS_COLORS.hover[1], zoneRatio));
    root.style.setProperty("--zone-active", interpolateColor(DARK_PLUS_COLORS.active[0], DARK_PLUS_COLORS.active[1], zoneRatio));
  }
  // Zone 4: Pure Dark (75-100)
  else {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  }
}

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>("system");
  const [themeBlend, setThemeBlendState] = useState<number>(0);
  const [marsBackground, setMarsBackgroundState] = useState<boolean>(true);
  const [secretSpaceMode, setSecretSpaceModeState] = useState<boolean>(false);

  // Load theme from localforage on mount
  useEffect(() => {
    void Promise.all([
      localforage.getItem<Theme>(STORAGE_KEY),
      localforage.getItem<number>(BLEND_STORAGE_KEY),
      localforage.getItem<boolean>(MARS_BG_STORAGE_KEY),
      localforage.getItem<boolean>(SECRET_SPACE_STORAGE_KEY)
    ]).then(([storedTheme, storedBlend, storedMarsBg, storedSecretSpace]) => {
      const blend = storedBlend ?? 0;
      const theme = storedTheme ?? "system";
      const marsBg = storedMarsBg ?? true;
      const secretSpace = storedSecretSpace ?? false;
      setThemeState(theme);
      setThemeBlendState(blend);
      setMarsBackgroundState(marsBg);
      setSecretSpaceModeState(secretSpace);
      applyTheme(theme, blend);
    });
  }, []);

  // Apply theme and persist when theme or blend changes
  useEffect(() => {
    applyTheme(theme, themeBlend);
    void localforage.setItem(STORAGE_KEY, theme);
    void localforage.setItem(BLEND_STORAGE_KEY, themeBlend);
  }, [theme, themeBlend]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system" || themeBlend > 0) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system", themeBlend);

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme, themeBlend]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    // Reset blend when selecting a preset theme
    if (newTheme === "light") {
      setThemeBlendState(0);
    } else if (newTheme === "dark") {
      setThemeBlendState(100);
    }
  };

  const setThemeBlend = (blend: number) => {
    setThemeBlendState(blend);
    // Update theme based on blend position
    if (blend === 0) {
      setThemeState("light");
    } else if (blend === 100) {
      setThemeState("dark");
    } else {
      setThemeState("system"); // Use system as "custom" indicator
    }
  };

  const setMarsBackground = useCallback((enabled: boolean) => {
    setMarsBackgroundState(enabled);
    void localforage.setItem(MARS_BG_STORAGE_KEY, enabled);
  }, []);

  const setSecretSpaceMode = useCallback((enabled: boolean) => {
    setSecretSpaceModeState(enabled);
    void localforage.setItem(SECRET_SPACE_STORAGE_KEY, enabled);
  }, []);

  // Update favicon based on secret space mode
  useEffect(() => {
    // BASE_URL is '/Guido' (without trailing slash), need to add one
    let basePath = import.meta.env.BASE_URL || '/';
    if (!basePath.endsWith('/')) {
      basePath += '/';
    }
    
    // Remove existing favicon links
    const existingFavicons = document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']");
    existingFavicons.forEach(link => link.remove());
    
    // Create new favicon link with cache busting
    const newFavicon = document.createElement('link');
    newFavicon.rel = 'icon';
    
    if (secretSpaceMode) {
      // In secret mode, use guido_icon.png
      newFavicon.type = 'image/png';
      newFavicon.href = `${basePath}guido_icon.png?v=${Date.now()}`;
    } else {
      // Normal mode - use default favicon.svg
      newFavicon.type = 'image/svg+xml';
      newFavicon.href = `${basePath}favicon.svg?v=${Date.now()}`;
    }
    
    document.head.appendChild(newFavicon);
  }, [secretSpaceMode]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeBlend, setThemeBlend, marsBackground, setMarsBackground, secretSpaceMode, setSecretSpaceMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
