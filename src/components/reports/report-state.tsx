"use client";
// Estados de una pestaña de Reportes (FR-010): carga con esqueleto, error con "Reintentar" que conserva los
// datos previos, y vacío con guía. Nunca pinta ceros como si fueran datos.
import { useTranslations } from "next-intl";
import { AlertTriangle, FileBarChart2, RefreshCw } from "lucide-react";
import { CARD } from "./styles";
import type { ReportPeriod } from "@/hooks/use-report-period";

interface ReportStateProps {
  isLoading: boolean;
  isError: boolean;
  /** Ya hay datos (de esta consulta o de la anterior, con keepPreviousData). */
  hasData: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  period: ReportPeriod;
  /** Esqueleto propio de la pestaña; por defecto un bloque. */
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}

export function ReportState({ isLoading, isError, hasData, isEmpty, onRetry, period, skeleton, children }: ReportStateProps) {
  const t = useTranslations("reports.state");

  if (isLoading && !hasData) {
    return (
      <div role="status" aria-label={t("loading")}>
        {skeleton ?? <div className="h-56 animate-pulse rounded-etiqueta bg-muted" />}
      </div>
    );
  }

  if (isError && !hasData) {
    return (
      <div role="alert" className={`${CARD} flex flex-col items-center gap-2 py-12 text-center`}>
        <AlertTriangle size={28} strokeWidth={1.75} className="text-destructive" aria-hidden />
        <p className="font-semibold text-foreground">{t("errorTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
        <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-2 rounded-etiqueta bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground foco-etiqueta">
          <RefreshCw size={14} aria-hidden />
          {t("retry")}
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`${CARD} flex flex-col items-center gap-2 py-12 text-center`}>
        <FileBarChart2 size={32} strokeWidth={1.5} className="text-muted-foreground/60" aria-hidden />
        <p className="font-semibold text-foreground">{t("emptyTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {period.preset !== "mes" && (
            <button type="button" onClick={() => period.setPreset("mes")} className="rounded-etiqueta border border-border px-3 py-1.5 text-sm foco-etiqueta">
              {t("showMonth")}
            </button>
          )}
          {period.preset !== "mes-anterior" && (
            <button type="button" onClick={() => period.setPreset("mes-anterior")} className="rounded-etiqueta border border-border px-3 py-1.5 text-sm foco-etiqueta">
              {t("showPrevious")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {isError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-etiqueta border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm">
          <span>{t("staleError")}</span>
          <button type="button" onClick={onRetry} className="font-semibold underline foco-etiqueta">
            {t("retry")}
          </button>
        </div>
      )}
      {children}
    </>
  );
}
