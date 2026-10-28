// src/lib/whatsapp.ts — lectura de los errores de la API de WhatsApp (spec 047) para que cada pantalla los muestre en su idioma.
import { isAxiosError } from "axios";
import type { WhatsappState } from "@/types";

export interface WhatsappErrorInfo {
  /** `whatsapp_rejected`, `stale_object`, `confirmation_required`, `token_required`, `meta_unreachable`… */
  code: string | null;
  /** Motivo de un rechazo de Meta (`invalid_token`, `token_expired`…): clave de `whatsapp.reasons`. */
  reason: string | null;
  metaCode: string | null;
  status: number | null;
  /** Estado vigente que manda la API con un 409. */
  current: WhatsappState | null;
}

export function whatsappError(error: unknown): WhatsappErrorInfo {
  const empty: WhatsappErrorInfo = { code: null, reason: null, metaCode: null, status: null, current: null };
  if (!isAxiosError(error)) return empty;

  const details = error.response?.data?.error?.details;
  const object = details && typeof details === "object" ? (details as Record<string, unknown>) : {};
  return {
    code: typeof object.code === "string" ? object.code : null,
    reason: typeof object.reason === "string" ? object.reason : null,
    metaCode: typeof object.meta_code === "string" ? object.meta_code : null,
    status: error.response?.status ?? null,
    current: (object.current as WhatsappState | undefined) ?? null,
  };
}
