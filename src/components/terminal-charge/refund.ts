// src/components/terminal-charge/refund.ts — pasos del reembolso al anular un cobro integrado (spec 069, US6,
// contracts/api.md «Anulaciones con reembolso»). La API responde 422 `refund_confirmation_required` (con lo que se
// devolvería) o `refund_failed` (con el motivo); la pantalla confirma, reintenta o anula sin reembolso.
import type { TicketPayment } from "@/types";

export interface RefundLine {
  ticket_payment_id: number;
  amount: string;
  terminal: { id: number; name: string } | null;
}

export type RefundMode = "confirm" | "skip";

export type RefundStep =
  | { kind: "confirm"; refunds: RefundLine[] }
  | { kind: "failed"; reason: string; message: string | null; refunds: RefundLine[] }
  | { kind: "skipConfirm"; refunds: RefundLine[] };

interface ErrorShape {
  response?: { data?: { error?: { message?: string; details?: { code?: string; reason?: string; refunds?: RefundLine[] } } } };
}

/** El paso que sigue según el error de la anulación, o null si el error no tiene que ver con el reembolso. */
export function refundStepFrom(error: unknown, previous: RefundStep | null = null): RefundStep | null {
  const body = (error as ErrorShape)?.response?.data?.error;
  const details = body?.details;
  if (details?.code === "refund_confirmation_required") return { kind: "confirm", refunds: details.refunds ?? [] };
  if (details?.code === "refund_failed") {
    return { kind: "failed", reason: details.reason ?? "refund_rejected", message: body?.message ?? null, refunds: previous?.refunds ?? [] };
  }
  return null;
}

/** ¿Hay pagos con tarjeta registrados a mano? Su devolución se hace en la terminal o con el banco (FR-037). */
export function hasManualCard(payments: TicketPayment[] | undefined | null) {
  return (payments ?? []).some((payment) => !payment.voided_at && payment.method === "card" && payment.source !== "terminal");
}

export const REFUND_REASONS = [
  "refund_period_exceeded",
  "insufficient_money_for_refund",
  "connection_error",
  "provider_unavailable",
  "refund_rejected",
] as const;
