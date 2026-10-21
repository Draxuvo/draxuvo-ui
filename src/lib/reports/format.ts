import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";

/** Cifras y gráficas en pesos enteros; las tablas de detalle (cobros, salarios, costos) con centavos para cuadrar. */
export function formatCurrency(value: number, locale = "es", cents = false): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${Math.abs(value).toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`;
}

/** "2026-10-21" → "21 oct 2026" (sin pasar por UTC: la fecha se arma en local). */
export function formatDay(iso: string, locale = "es"): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return format(new Date(y, m - 1, d), "dd MMM yyyy", { locale: locale === "en" ? enUS : es });
}

export function formatRange(range: { from: string; to: string }, locale = "es"): string {
  return range.from === range.to
    ? formatDay(range.from, locale)
    : `${formatDay(range.from, locale)} – ${formatDay(range.to, locale)}`;
}

/** Clave de periodo de la API → etiqueta: "2026-03-10" → "10 mar", "2026-W11" y "2026-03" se dejan tal cual. */
export function periodLabel(key: string, locale = "es"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  const [y, m, d] = key.split("-").map(Number);
  return format(new Date(y, m - 1, d), "dd MMM", { locale: locale === "en" ? enUS : es });
}
