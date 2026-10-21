export type Direction = "up" | "down" | "flat";

export interface Variation {
  /** Porcentaje contra el periodo anterior; null si el anterior fue 0 (no hay base comparable). */
  pct: number | null;
  direction: Direction;
  /** Si el cambio es bueno para el negocio; null si no hay base comparable o no cambió. */
  favorable: boolean | null;
}

/** `goodWhen`: sube es bueno (ingresos) o baja es bueno (gastos). */
export function variation(current: number, previous: number, goodWhen: "up" | "down"): Variation {
  const direction: Direction = current > previous ? "up" : current < previous ? "down" : "flat";
  if (previous <= 0) return { pct: null, direction, favorable: null };
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  return { pct, direction, favorable: direction === "flat" ? null : direction === goodWhen };
}
