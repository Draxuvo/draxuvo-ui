// src/lib/quantity.ts — cantidades de inventario con su unidad (spec 016): "7.5 kg", "12 pza".
import type { UnitRef } from "@/types";

export function formatQuantity(value: number | null | undefined, unit?: UnitRef | null, locale = "es") {
  if (value === null || value === undefined) return "—";
  const number = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { maximumFractionDigits: 3 }).format(value);
  return unit ? `${number} ${unit.key}` : number;
}
