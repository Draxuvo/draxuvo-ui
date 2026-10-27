"use client";
import { useCallback, useState } from "react";

export interface SoundPreference {
  enabled: boolean;
  volume: number;
}

const PREFIX = "draxuvo.sound.";
const DEFAULT: SoundPreference = { enabled: false, volume: 1 };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function read(key: string): SoundPreference {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<SoundPreference>;
    return {
      enabled: parsed.enabled === true,
      volume: typeof parsed.volume === "number" ? clamp(parsed.volume) : 1,
    };
  } catch {
    return DEFAULT;
  }
}

function write(key: string, pref: SoundPreference): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(pref));
  } catch {
    // Sin almacenamiento: la preferencia vive solo en memoria.
  }
}

export function useSoundPreference(surfaceKey: string) {
  const [pref, setPref] = useState<SoundPreference>(() => read(surfaceKey));

  const setEnabled = useCallback((enabled: boolean) => {
    setPref((prev) => {
      const next = { ...prev, enabled };
      write(surfaceKey, next);
      return next;
    });
  }, [surfaceKey]);

  const setVolume = useCallback((volume: number) => {
    setPref((prev) => {
      const next = { ...prev, volume: clamp(volume) };
      write(surfaceKey, next);
      return next;
    });
  }, [surfaceKey]);

  return { enabled: pref.enabled, volume: pref.volume, setEnabled, setVolume };
}
