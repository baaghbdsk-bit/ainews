"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [isLight, toggleTheme] = useTheme();

  return (
    <button
      type="button"
      className={className || "header-icon-button header-theme-toggle"}
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      aria-pressed={isLight}
      title={isLight ? "Dark theme" : "Light theme"}
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
