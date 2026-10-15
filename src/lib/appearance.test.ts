import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAppearance,
  fromPreferences,
  parseAppearanceKey,
  parseMode,
  parseTheme,
  readAppearanceKey,
  subscribeAppearance,
} from "./appearance";

function clearCookies() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  });
}

beforeEach(() => {
  clearCookies();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.mode;
});

describe("parseTheme y parseMode", () => {
  it("devuelven el valor cuando es válido", () => {
    expect(parseTheme("grafito")).toBe("grafito");
    expect(parseMode("dark")).toBe("dark");
  });

  it("caen en anaquel y sistema con null, undefined o valores desconocidos", () => {
    for (const v of [null, undefined, "", "neon"]) {
      expect(parseTheme(v)).toBe("anaquel");
      expect(parseMode(v)).toBe("system");
    }
  });
});

describe("fromPreferences", () => {
  it("mapea color_mode a mode", () => {
    expect(fromPreferences({ theme: "mercado", color_mode: "dark" })).toEqual({ theme: "mercado", mode: "dark" });
  });

  it("tolera null, undefined y valores inválidos", () => {
    expect(fromPreferences(null)).toEqual({ theme: "anaquel", mode: "system" });
    expect(fromPreferences(undefined)).toEqual({ theme: "anaquel", mode: "system" });
    expect(fromPreferences({ theme: "x", color_mode: "y" })).toEqual({ theme: "anaquel", mode: "system" });
  });
});

describe("clave de apariencia", () => {
  it("lee la clave por defecto cuando el <html> no tiene atributos", () => {
    expect(readAppearanceKey()).toBe("anaquel|system");
  });

  it("hace ida y vuelta entre readAppearanceKey y parseAppearanceKey", () => {
    document.documentElement.dataset.theme = "talavera";
    document.documentElement.dataset.mode = "light";
    const key = readAppearanceKey();
    expect(key).toBe("talavera|light");
    expect(parseAppearanceKey(key)).toEqual({ theme: "talavera", mode: "light" });
  });

  it("parseAppearanceKey sanea claves inválidas", () => {
    expect(parseAppearanceKey("foo")).toEqual({ theme: "anaquel", mode: "system" });
  });
});

describe("applyAppearance", () => {
  it("escribe los atributos del <html> y las cookies", () => {
    const setter = vi.spyOn(document, "cookie", "set");
    applyAppearance({ theme: "rosa_mexicano", mode: "dark" });
    expect(document.documentElement.dataset.theme).toBe("rosa_mexicano");
    expect(document.documentElement.dataset.mode).toBe("dark");
    expect(setter).toHaveBeenCalledWith("draxuvo_theme=rosa_mexicano; path=/; max-age=31536000; SameSite=Lax");
    expect(setter).toHaveBeenCalledWith("draxuvo_mode=dark; path=/; max-age=31536000; SameSite=Lax");
    setter.mockRestore();
    expect(document.cookie).toContain("draxuvo_theme=rosa_mexicano");
    expect(document.cookie).toContain("draxuvo_mode=dark");
  });

  it("sanea entradas inválidas", () => {
    applyAppearance({ theme: "zzz" as never, mode: "qqq" as never });
    expect(document.documentElement.dataset.theme).toBe("anaquel");
    expect(document.documentElement.dataset.mode).toBe("system");
  });

  it("avisa a los suscriptores y deja de avisar tras cancelar la suscripción", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAppearance(listener);
    applyAppearance({ theme: "mercado", mode: "light" });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    applyAppearance({ theme: "grafito", mode: "dark" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
