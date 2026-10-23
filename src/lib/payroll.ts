// src/lib/payroll.ts
// Ayudantes de la nómina (spec 037): los montos viajan en centavos MXN.
import { formatCurrency } from "@/lib/reports/format";
import type { PayrollRunStatus } from "@/types";

export function money(cents: number, locale = "es"): string {
  return formatCurrency(cents / 100, locale, true);
}

/** Pesos escritos por el jefe ("1,250.50") a centavos enteros; NaN si no es un número. */
export function pesosToCents(text: string): number {
  const value = Number(text.replace(/,/g, "").trim());
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

export const STATUS_TONE: Record<PayrollRunStatus, "secondary" | "default" | "outline" | "destructive"> = {
  draft: "secondary",
  approved: "outline",
  partial: "outline",
  paid: "default",
  cancelled: "destructive",
};

/** Hoy como YYYY-MM-DD en hora local (la fecha de pago no puede ser futura). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
