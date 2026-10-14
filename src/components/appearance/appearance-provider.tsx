"use client";
// Reemplaza al ThemeProvider de next-themes: el estado vive en los atributos del <html>.
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  type Appearance,
  type ColorMode,
  type ThemeKey,
  DEFAULT_APPEARANCE,
  applyAppearance,
  parseAppearanceKey,
  readAppearanceKey,
  subscribeAppearance,
} from "@/lib/appearance";

type AppearanceContextValue = {
  theme: ThemeKey;
  mode: ColorMode;
  /** Modo efectivo (para sonner): "system" ya resuelto con prefers-color-scheme. */
  resolvedMode: "light" | "dark";
  setAppearance: (appearance: Appearance) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);
const DARK_QUERY = "(prefers-color-scheme: dark)";
const SERVER_KEY = `${DEFAULT_APPEARANCE.theme}|${DEFAULT_APPEARANCE.mode}`;

function subscribeSystemDark(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const key = useSyncExternalStore(subscribeAppearance, readAppearanceKey, () => SERVER_KEY);
  const systemDark = useSyncExternalStore(
    subscribeSystemDark,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  const setAppearance = useCallback((appearance: Appearance) => applyAppearance(appearance), []);

  const value = useMemo<AppearanceContextValue>(() => {
    const { theme, mode } = parseAppearanceKey(key);
    const resolvedMode = mode === "system" ? (systemDark ? "dark" : "light") : mode;
    return { theme, mode, resolvedMode, setAppearance };
  }, [key, systemDark, setAppearance]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance debe usarse dentro de AppearanceProvider");
  return context;
}
