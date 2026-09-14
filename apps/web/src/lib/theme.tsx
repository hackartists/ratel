// app/ratel/src/common/components/theme_switcher (ThemeService) and the JS it
// drives (apps/web/shell-js/src/ratel-app-shell/common/theme.js): same storage key,
// same `system` resolution, same `data-theme` attribute. index.html already
// applies the saved theme before first paint; this keeps it in sync.
import * as React from "react";

export const Theme = {
  Light: "light",
  Dark: "dark",
  System: "system",
} as const;
export type Theme = (typeof Theme)[keyof typeof Theme];

const STORAGE_KEY = "ratel-common-theme";

function parseTheme(value: string | null): Theme {
  return value === "light" || value === "dark" || value === "system" ? value : Theme.System;
}

export function loadTheme(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage blocked
  }
}

export function applyTheme(theme: Theme): void {
  const resolved =
    theme === Theme.System ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
  window.document.documentElement.setAttribute("data-theme", resolved);
}

export interface ThemeService {
  current: Theme;
  set(theme: Theme): void;
}

const ThemeContext = React.createContext<ThemeService | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // First render uses the default, then the saved theme once storage answers
  // (Rust `ThemeService::init`).
  const [current, setCurrent] = React.useState<Theme>(Theme.System);

  React.useEffect(() => {
    const saved = parseTheme(loadTheme());
    setCurrent(saved);
    applyTheme(saved);
  }, []);

  const service = React.useMemo<ThemeService>(
    () => ({
      current,
      set: (theme) => {
        setCurrent(theme);
        saveTheme(theme);
        applyTheme(theme);
      },
    }),
    [current],
  );
  return <ThemeContext.Provider value={service}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeService {
  const service = React.useContext(ThemeContext);
  if (!service) throw new Error("useTheme must be used inside ThemeProvider");
  return service;
}
