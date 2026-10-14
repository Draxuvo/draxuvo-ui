// Apariencia del panel (spec 006): única lista de temas, cookies y aplicación al <html>.
// La API valida contra su propia lista con las mismas claves (User::THEMES, User::COLOR_MODES).
export const THEME_KEYS = ["anaquel", "mercado", "talavera", "rosa_mexicano", "grafito"] as const;
export const COLOR_MODES = ["light", "dark", "system"] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];
export type ColorMode = (typeof COLOR_MODES)[number];
export type Appearance = { theme: ThemeKey; mode: ColorMode };

export const THEME_COOKIE = "draxuvo_theme";
export const MODE_COOKIE = "draxuvo_mode";
export const DEFAULT_APPEARANCE: Appearance = { theme: "anaquel", mode: "system" };
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Un tema desconocido o ausente cae en anaquel (FR-010). */
export function parseTheme(value: string | null | undefined): ThemeKey {
  return THEME_KEYS.find((key) => key === value) ?? DEFAULT_APPEARANCE.theme;
}

/** Un modo desconocido o ausente cae en sistema (FR-010). */
export function parseMode(value: string | null | undefined): ColorMode {
  return COLOR_MODES.find((key) => key === value) ?? DEFAULT_APPEARANCE.mode;
}

/** La API habla `color_mode`; la UI, `mode`. */
export function fromPreferences(preferences?: { theme?: string; color_mode?: string } | null): Appearance {
  return { theme: parseTheme(preferences?.theme), mode: parseMode(preferences?.color_mode) };
}

const listeners = new Set<() => void>();

export function subscribeAppearance(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** "tema|modo" tal como están pintados en el <html>; texto para que useSyncExternalStore lo compare. */
export function readAppearanceKey(): string {
  const { dataset } = document.documentElement;
  return `${parseTheme(dataset.theme)}|${parseMode(dataset.mode)}`;
}

export function parseAppearanceKey(key: string): Appearance {
  const [theme, mode] = key.split("|");
  return { theme: parseTheme(theme), mode: parseMode(mode) };
}

/**
 * Escribe las cookies, los atributos del <html> y avisa a quien escucha. No llama a la API.
 * El layout del servidor lee las mismas cookies para pintar el <html> sin destello.
 */
export function applyAppearance({ theme, mode }: Appearance) {
  const safe = { theme: parseTheme(theme), mode: parseMode(mode) };
  const cookie = (name: string, value: string) =>
    `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  document.cookie = cookie(THEME_COOKIE, safe.theme);
  document.cookie = cookie(MODE_COOKIE, safe.mode);
  document.documentElement.dataset.theme = safe.theme;
  document.documentElement.dataset.mode = safe.mode;
  listeners.forEach((listener) => listener());
}
