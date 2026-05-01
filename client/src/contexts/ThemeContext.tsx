import React, { createContext, useContext, useEffect, useState } from "react";

export type GenderTheme = "female" | "male" | "unisex";
type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: GenderTheme;
  setTheme: (theme: GenderTheme) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  defaultGenderTheme?: GenderTheme;
}

function applyGenderTheme(theme: GenderTheme) {
  const root = document.documentElement;
  root.classList.remove("theme-female", "theme-male", "theme-unisex");
  root.classList.add(`theme-${theme}`);
}

function applyDarkMode(isDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  defaultGenderTheme = "female",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<GenderTheme>(() => {
    if (typeof window === "undefined") return defaultGenderTheme;
    const storedTheme = localStorage.getItem("natura_theme_preference");
    return storedTheme === "male" || storedTheme === "unisex" || storedTheme === "female"
      ? storedTheme
      : defaultGenderTheme;
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultTheme === "dark";
    const storedDarkMode = localStorage.getItem("natura_dark_mode");
    if (storedDarkMode !== null) {
      return storedDarkMode === "true";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches || defaultTheme === "dark";
  });

  useEffect(() => {
    applyGenderTheme(theme);
    localStorage.setItem("natura_theme_preference", theme);
  }, [theme]);

  useEffect(() => {
    applyDarkMode(isDark);
    localStorage.setItem("natura_dark_mode", String(isDark));
  }, [isDark]);

  const setTheme = (nextTheme: GenderTheme) => {
    setThemeState(nextTheme);
  };

  const toggleDarkMode = () => {
    setIsDark(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
