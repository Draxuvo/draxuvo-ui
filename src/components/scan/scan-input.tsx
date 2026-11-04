// src/components/scan/scan-input.tsx
// Campo de captura de códigos (specs 034 y 056): la pistola USB o el teclado escriben el código y terminan con Enter
// o Tab; el botón de cámara abre el lector (CameraDialog). Las tres formas pasan por la misma cola y llaman a
// `onScan` con el texto ya limpio, de uno en uno y en el orden en que llegan (FR-003).
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Detector } from "@/lib/scan/detector";
import { normalizeCode } from "@/lib/scan/lib";
import { CameraDialog } from "./camera-dialog";

export interface ScanInputProps {
  /** Se llama con cada código, de uno en uno y en orden. */
  onScan: (code: string) => Promise<void> | void;
  disabled?: boolean;
  /** Cambia para devolver el foco al campo (por ejemplo al cerrar un diálogo). */
  focusSignal?: number;
  /** Muestra el botón de cámara (por omisión sí). */
  allowCamera?: boolean;
  /** Para pruebas: detector ya armado. */
  detector?: Detector;
}

export function ScanInput({ onScan, disabled = false, focusSignal = 0, allowCamera = true, detector }: ScanInputProps) {
  const t = useTranslations("inventory.scan");
  const ts = useTranslations("scan");
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [value, setValue] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!disabled && !cameraOpen) inputRef.current?.focus();
  }, [disabled, focusSignal, cameraOpen]);

  function enqueue(code: string) {
    // Cada escaneo espera al anterior: dos lecturas seguidas no se pisan ni se pierden.
    queue.current = queue.current.then(async () => {
      try {
        await onScan(code);
      } catch {
        // El aviso del error ya lo dio quien procesa el código.
      }
    });
    return queue.current;
  }

  function submit() {
    const code = normalizeCode(value);
    setValue("");
    inputRef.current?.focus();
    if (code) void enqueue(code);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <ScanBarcode size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          disabled={disabled}
          autoComplete="off"
          autoFocus
          inputMode="numeric"
          aria-label={t("label")}
          placeholder={t("placeholder")}
          className="h-12 pl-10 text-base"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Tab") {
              if (value.trim() || event.key === "Enter") event.preventDefault();
              if (value.trim()) submit();
            }
          }}
        />
      </div>
      {allowCamera && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={ts("open")}
            title={ts("open")}
            onClick={() => setCameraOpen(true)}
            className="size-12 shrink-0"
          >
            <Camera size={20} aria-hidden />
          </Button>
          <CameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onScan={enqueue} detector={detector} />
        </>
      )}
    </div>
  );
}
