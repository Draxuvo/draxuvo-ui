"use client";
// Periodo de Reportes en la URL (specs/028-reportes-rediseno/research.md R2): lo comparten las cuatro
// pestañas y sobrevive a recargas y enlaces. La página que lo usa debe estar dentro de <Suspense>.
import { useCallback } from "react";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { DEFAULT_PRESET, PRESETS, isValidRange, localToday, rangeFor, type Preset } from "@/lib/reports/period";
import type { DateRange } from "@/services/reports";

const DEFAULTS = { rango: DEFAULT_PRESET as string, desde: "", hasta: "", comparar: "" };
const ALLOWED = { rango: PRESETS as readonly string[] };

export interface ReportPeriod {
  preset: Preset;
  range: DateRange;
  compare: boolean;
  setPreset: (preset: Preset) => void;
  /** Solo aplica rangos válidos; devuelve false si "Hasta" es anterior a "Desde". */
  setCustom: (range: DateRange) => boolean;
  setCompare: (on: boolean) => void;
}

export function useReportPeriod(): ReportPeriod {
  const { filters, setFilters } = useUrlFilters(DEFAULTS, { allowed: ALLOWED });
  const preset = filters.rango as Preset;
  const today = localToday();
  const range = rangeFor(preset, today, { from: filters.desde, to: filters.hasta });

  const setPreset = useCallback(
    (next: Preset) => {
      if (next === "personalizado") setFilters({ rango: next, desde: range.from, hasta: range.to });
      else setFilters({ rango: next, desde: null, hasta: null });
    },
    [setFilters, range.from, range.to],
  );

  const setCustom = useCallback(
    (next: DateRange) => {
      if (!isValidRange(next)) return false;
      setFilters({ rango: "personalizado", desde: next.from, hasta: next.to });
      return true;
    },
    [setFilters],
  );

  const setCompare = useCallback((on: boolean) => setFilters({ comparar: on ? "1" : null }), [setFilters]);

  return { preset, range, compare: filters.comparar === "1", setPreset, setCustom, setCompare };
}
