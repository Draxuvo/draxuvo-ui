// Periodo de Reportes (specs/028-reportes-rediseno/data-model.md). Todo se calcula con la fecha LOCAL
// de la persona: toISOString() daría la de UTC, que en México ya es "mañana" después de las 18:00.
import { addDays, endOfMonth, format, parseISO, startOfMonth, subMonths, differenceInCalendarDays } from "date-fns";
import type { DateRange, GroupBy } from "@/services/reports";

export const PRESETS = ["hoy", "7d", "mes", "mes-anterior", "personalizado"] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = "mes";

const ISO = "yyyy-MM-dd";

export function localToday(now: Date = new Date()): string {
  return format(now, ISO);
}

/** Rango de un atajo. `personalizado` usa las fechas dadas y, si no son válidas, cae en el mes en curso. */
export function rangeFor(preset: Preset, today: string, custom?: Partial<DateRange>): DateRange {
  const day = parseISO(today);
  switch (preset) {
    case "hoy":
      return { from: today, to: today };
    case "7d":
      return { from: format(addDays(day, -6), ISO), to: today };
    case "mes-anterior": {
      const previous = subMonths(day, 1);
      return { from: format(startOfMonth(previous), ISO), to: format(endOfMonth(previous), ISO) };
    }
    case "personalizado":
      if (custom?.from && custom?.to && isValidRange({ from: custom.from, to: custom.to })) {
        return { from: custom.from, to: custom.to };
      }
      return rangeFor("mes", today);
    default:
      return { from: format(startOfMonth(day), ISO), to: today };
  }
}

export function isValidRange(range: DateRange): boolean {
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  return ok.test(range.from) && ok.test(range.to) && range.from <= range.to;
}

export function dayCount(range: DateRange): number {
  return differenceInCalendarDays(parseISO(range.to), parseISO(range.from)) + 1;
}

/** Periodo anterior de igual duración que termina el día antes de que empiece `range`. */
export function previousRange(range: DateRange): DateRange {
  const days = dayCount(range);
  const from = parseISO(range.from);
  return { from: format(addDays(from, -days), ISO), to: format(addDays(from, -1), ISO) };
}

/** Agrupación de las gráficas según la duración (FR-006c): ≤31 días por día, ≤186 por semana, más por mes. */
export function groupByFor(range: DateRange): GroupBy {
  const days = dayCount(range);
  if (days <= 31) return "day";
  if (days <= 186) return "week";
  return "month";
}
