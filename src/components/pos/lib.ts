// Reglas puras de la caja de venta de mostrador (spec 050). No tocan red ni React.
import type { AxiosError } from "axios";

/** Código de error de la API (`error.details.code`), si lo trae. */
export function errorCode(err: unknown): string | undefined {
  const e = err as AxiosError<{ error?: { code?: string; details?: { code?: string } } }>;
  return e.response?.data?.error?.details?.code ?? e.response?.data?.error?.code;
}

export const ITEM_ERROR_CODES = [
  "product_not_found",
  "product_not_sellable",
  "product_inactive",
  "product_without_price",
  "invalid_quantity",
  "not_open",
] as const;

/** Spec 058: rechazos de «Cobro solo por jefes» que recargan la venta y muestran el aviso. */
export const BOSS_ONLY_CODES = ["charge_boss_only", "sale_submitted"] as const;

export const isBossOnlyError = (err: unknown) => (BOSS_ONLY_CODES as readonly string[]).includes(errorCode(err) ?? "");

export const CHARGE_ERROR_CODES = ["empty", "not_open", "stale_object"] as const;

/** Paso de la cantidad: una pieza, o media si el producto se vende por fracción. */
export const quantityStep = (fractional: boolean) => (fractional ? 0.5 : 1);

export const toMoney = (value: string | number | null | undefined) => Number(value ?? 0);

export function formatMoney(value: string | number | null | undefined, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" }).format(toMoney(value));
}

/** Nueva cantidad al sumar o restar un paso; nunca baja de cero (cero quita el renglón). */
export function nextQuantity(current: number, direction: 1 | -1, fractional: boolean): number {
  const step = quantityStep(fractional);
  return Math.max(0, Math.round((current + direction * step) * 1000) / 1000);
}
