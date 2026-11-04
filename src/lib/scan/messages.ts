// src/lib/scan/messages.ts
// Aviso de una lectura que no se pudo agregar (spec 056, FR-010): siempre dice el código leído y el motivo.
import type { ScanReason } from "./resolve";

type Translate = (key: "notFound" | "notSellable" | "notOnMenu", values: Record<string, string>) => string;

export function scanFailureText(t: Translate, code: string, failure: { reason: ScanReason; name?: string }): string {
  const key = failure.reason === "not_sellable" ? "notSellable" : failure.reason === "not_on_menu" ? "notOnMenu" : "notFound";
  return t(key, { code, name: failure.name ?? code });
}
