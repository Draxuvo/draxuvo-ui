// src/components/filters/search-input.tsx
// Búsqueda de las listas (FR-032): borrador local que escribe en la URL con 400 ms de espera y
// se resincroniza cuando la URL cambia desde fuera (por ejemplo "Limpiar filtros").
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Search } from "lucide-react";
import { CameraDialog } from "@/components/scan/camera-dialog";
import { Input } from "@/components/ui/input";
import type { Detector } from "@/lib/scan/detector";
import { normalizeCode } from "@/lib/scan/lib";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 400;

interface SearchInputProps {
  /** Valor aplicado (el de la URL). */
  value: string;
  /** Se llama con el texto tras la espera; la página lo escribe en la URL. */
  onSearch: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Botón de cámara: el código leído se busca al instante, sin la espera de 400 ms (spec 056). */
  scannable?: boolean;
  /** Avisa el código leído con la cámara, además de buscarlo. */
  onScan?: (code: string) => void;
  /** Para pruebas: detector ya armado. */
  detector?: Detector;
}

export function SearchInput({ value, onSearch, placeholder, className, scannable = false, onScan, detector }: SearchInputProps) {
  const tc = useTranslations("common");
  const ts = useTranslations("scan");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    if (draft.trim() !== value) setDraft(value);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleChange(next: string) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), DEBOUNCE_MS);
  }

  function handleScan(raw: string) {
    const code = normalizeCode(raw);
    if (!code) return;
    if (timer.current) clearTimeout(timer.current);
    setDraft(code);
    setCameraOpen(false);
    onSearch(code);
    onScan?.(code);
  }

  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <Search
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={tc("search")}
        placeholder={placeholder}
        className={cn("pl-9", scannable && "pr-11")}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
      />
      {scannable && (
        <>
          <button
            type="button"
            aria-label={ts("open")}
            title={ts("open")}
            onClick={() => setCameraOpen(true)}
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Camera size={18} aria-hidden />
          </button>
          <CameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onScan={handleScan} detector={detector} />
        </>
      )}
    </div>
  );
}
