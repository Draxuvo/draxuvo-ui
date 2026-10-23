// src/components/inventory/scan/scan-field.tsx
// Campo de captura para pistola de códigos de barras (spec 034): la pistola escribe el código como teclado y
// termina con Enter. Mantiene el foco, procesa los escaneos en el orden en que llegan aunque la respuesta tarde
// y toma Tab como fin de captura sin salirse del campo.
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ScanBarcode } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ScanFieldProps {
  /** Se llama con cada código, de uno en uno y en orden. */
  onScan: (code: string) => Promise<void> | void;
  disabled?: boolean;
  /** Cambia para devolver el foco al campo (por ejemplo al cerrar un diálogo). */
  focusSignal?: number;
}

export function ScanField({ onScan, disabled = false, focusSignal = 0 }: ScanFieldProps) {
  const t = useTranslations("inventory.scan");
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled, focusSignal]);

  function submit() {
    const code = value.trim();
    setValue("");
    inputRef.current?.focus();
    if (!code) return;
    // Cada escaneo espera al anterior: dos lecturas seguidas no se pisan ni se pierden.
    queue.current = queue.current.then(async () => {
      try {
        await onScan(code);
      } catch {
        // El aviso del error ya lo dio quien procesa el código.
      }
    });
  }

  return (
    <div className="relative">
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
  );
}
