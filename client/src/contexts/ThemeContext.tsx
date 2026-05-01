import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";

export type GenderTheme = "female" | "male" | "unisex";
type ThemeMode = "light" | "dark";
type StorefrontBrand = "natura" | "nikken";

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

const LEGACY_THEME_STORAGE_KEY = "natura_theme_preference";
const LEGACY_DARK_MODE_STORAGE_KEY = "natura_dark_mode";

function getBrandFromPath(pathname: string): StorefrontBrand {
  return pathname.startsWith("/nikken") ? "nikken" : "natura";
}

function getThemeStorageKey(brand: StorefrontBrand) {
  return brand === "nikken" ? "nikken_theme_preference" : LEGACY_THEME_STORAGE_KEY;
}

function getDarkModeStorageKey(brand: StorefrontBrand) {
  return brand === "nikken" ? "nikken_dark_mode" : LEGACY_DARK_MODE_STORAGE_KEY;
}

function readStoredThemePreference(
  brand: StorefrontBrand,
  defaultGenderTheme: GenderTheme,
) {
  if (typeof window === "undefined") return defaultGenderTheme;

  const storedTheme = localStorage.getItem(getThemeStorageKey(brand));
  return storedTheme === "male" || storedTheme === "unisex" || storedTheme === "female"
    ? storedTheme
    : defaultGenderTheme;
}

function readStoredDarkModePreference(brand: StorefrontBrand, defaultTheme: ThemeMode) {
  if (typeof window === "undefined") return defaultTheme === "dark";

  const storedDarkMode = localStorage.getItem(getDarkModeStorageKey(brand));
  if (storedDarkMode !== null) {
    return storedDarkMode === "true";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches || defaultTheme === "dark";
}

function buildInitialThemePreferences(defaultGenderTheme: GenderTheme) {
  return {
    natura: readStoredThemePreference("natura", defaultGenderTheme),
    nikken: readStoredThemePreference("nikken", defaultGenderTheme),
  } satisfies Record<StorefrontBrand, GenderTheme>;
}

function buildInitialDarkModePreferences(defaultTheme: ThemeMode) {
  return {
    natura: readStoredDarkModePreference("natura", defaultTheme),
    nikken: readStoredDarkModePreference("nikken", defaultTheme),
  } satisfies Record<StorefrontBrand, boolean>;
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
  const [location] = useLocation();
  const activeBrand = getBrandFromPath(location);
  const [themePreferences, setThemePreferences] = useState<Record<StorefrontBrand, GenderTheme>>(() =>
    buildInitialThemePreferences(defaultGenderTheme),
  );
  const [darkModePreferences, setDarkModePreferences] = useState<Record<StorefrontBrand, boolean>>(() =>
    buildInitialDarkModePreferences(defaultTheme),
  );
  const theme = themePreferences[activeBrand];
  const isDark = darkModePreferences[activeBrand];

  useEffect(() => {
    applyGenderTheme(theme);
    localStorage.setItem(getThemeStorageKey(activeBrand), theme);
  }, [activeBrand, theme]);

  useEffect(() => {
    applyDarkMode(isDark);
    localStorage.setItem(getDarkModeStorageKey(activeBrand), String(isDark));
  }, [activeBrand, isDark]);

  const setTheme = (nextTheme: GenderTheme) => {
    setThemePreferences(prev => ({
      ...prev,
      [activeBrand]: nextTheme,
    }));
  };

  const toggleDarkMode = () => {
    setDarkModePreferences(prev => ({
      ...prev,
      [activeBrand]: !prev[activeBrand],
    }));
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
