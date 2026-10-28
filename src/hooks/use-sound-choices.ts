"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { AlertKind } from "@/lib/sounds/catalog";
import { compact, parseChoices, type SoundChoices } from "@/lib/sounds/choices";
import type { SoundId } from "@/lib/sounds/catalog";

const KEY = "draxuvo.sound-choices";
const EMPTY: SoundChoices = {};

let cache: { raw: string | null; value: SoundChoices } | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return cache?.raw ?? null;
  }
}

// La instantánea debe ser estable entre lecturas: solo cambia si cambia el texto guardado.
function snapshot(): SoundChoices {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, value: parseChoices(raw) };
  return cache.value;
}

function write(next: SoundChoices): void {
  const value = compact(next);
  const raw = Object.keys(value).length ? JSON.stringify(value) : null;
  try {
    if (raw) window.localStorage.setItem(KEY, raw);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento: la elección vive solo en memoria hasta recargar.
  }
  cache = { raw, value };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Elecciones de sonido por alerta, de este dispositivo (spec 046). Compartidas por todos los componentes. */
export function useSoundChoices() {
  const choices = useSyncExternalStore(subscribe, snapshot, () => EMPTY);

  const choose = useCallback((alert: AlertKind, id: SoundId) => write({ ...snapshot(), [alert]: id }), []);
  const reset = useCallback((alert: AlertKind) => {
    const next = { ...snapshot() };
    delete next[alert];
    write(next);
  }, []);
  const resetAll = useCallback(() => write({}), []);

  return { choices, choose, reset, resetAll };
}
