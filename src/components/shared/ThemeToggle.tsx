import React from "react";
import { type Theme, useTheme } from "@/hooks/useTheme";

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes: { value: Theme; icon: string; label: string }[] = [
    { value: "light", icon: "☀️", label: "Light" },
    { value: "dark", icon: "🌙", label: "Dark" },
    { value: "system", icon: "💻", label: "System" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-1 rounded-lg">
      {themes.map(({ value, icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            theme === value
              ? "bg-surface-0 shadow-sm text-gray-900 dark:text-white"
              : "text-text-secondary hover:text-gray-900 dark:hover:text-white"
          }`}
          title={label}
          aria-label={`Switch to ${label} theme`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;
