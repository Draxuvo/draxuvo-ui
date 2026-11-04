// src/components/inventory/scan/scan-field.tsx
// Campo de captura de códigos (spec 034). Desde la spec 056 delega en ScanInput, que suma la cámara y la captura
// manual sin cambiar el comportamiento de la pistola (Enter o Tab terminan el código; cola ordenada).
"use client";
import { ScanInput, type ScanInputProps } from "@/components/scan/scan-input";

export type ScanFieldProps = ScanInputProps;

export function ScanField(props: ScanFieldProps) {
  return <ScanInput {...props} />;
}
