"use client";
// Barra de periodo única de Reportes (FR-001 a FR-003, FR-007): atajos, rango personalizado validado,
// el rango vigente en texto y, en Resumen, el interruptor para comparar con el periodo anterior.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { PRESETS, isValidRange, previousRange } from "@/lib/reports/period";
import { formatRange } from "@/lib/reports/format";
import type { ReportPeriod } from "@/hooks/use-report-period";
import { CARD, FIELD } from "./styles";

export function PeriodBar({ period, showCompare }: { period: ReportPeriod; showCompare: boolean }) {
  const t = useTranslations("reports.period");
  const locale = useLocale();
  const { preset, range, compare } = period;

  // Borrador de "Desde/Hasta": solo se aplica cuando el rango es válido; mientras no, se avisa junto al campo.
  const [draft, setDraft] = useState(range);
  const [synced, setSynced] = useState(range);
  if (synced.from !== range.from || synced.to !== range.to) {
    setSynced(range);
    setDraft(range);
  }
  const invalid = !!draft.from && !!draft.to && !isValidRange(draft);

  function edit(patch: Partial<typeof draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (next.from && next.to) period.setCustom(next);
  }

  return (
    <div className={cn(CARD, "flex flex-col gap-3 py-4")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div role="group" aria-label={t("label")} className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => period.setPreset(p)}
              className={cn(
                "rounded-etiqueta border px-3 py-1.5 text-sm font-medium foco-etiqueta transition-colors",
                preset === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {t(p)}
            </button>
          ))}
        </div>

        {preset === "personalizado" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              {t("from")}
              <input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => edit({ from: e.target.value })} aria-invalid={invalid} className={FIELD} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              {t("to")}
              <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => edit({ to: e.target.value })} aria-invalid={invalid} className={FIELD} />
            </label>
          </div>
        )}

        {showCompare && (
          <label className="ml-auto flex items-center gap-2 text-sm text-foreground">
            <Switch checked={compare} onCheckedChange={period.setCompare} />
            {t("compare")}
          </label>
        )}
      </div>

      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {t("invalidRange")}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{t("viewing", { range: formatRange(range, locale) })}</span>
        {showCompare && compare && <> · {t("previous", { range: formatRange(previousRange(range), locale) })}</>}
      </p>
    </div>
  );
}
