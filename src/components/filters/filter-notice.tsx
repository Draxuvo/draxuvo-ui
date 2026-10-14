// src/components/filters/filter-notice.tsx
// Aviso "Filtro aplicado" de las listas (FR-032): resume los filtros de la URL en la ceja y
// ofrece "Limpiar filtros". La página lo muestra solo con filtros (`isFiltered`).
"use client";
import { useTranslations } from "next-intl";

interface FilterNoticeProps {
  /** Filtros aplicados, ya legibles ("Estado: Pendiente", "\"cable\""). Vacíos se ignoran. */
  applied: (string | false | null | undefined | "")[];
  onClear: () => void;
}

export function FilterNotice({ applied, onClear }: FilterNoticeProps) {
  const tf = useTranslations("common.filters");
  const items = applied.filter(Boolean);

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-etiqueta bg-card px-3 py-2 text-sm shadow-etiqueta"
    >
      <span className="rounded-full bg-ceja px-2 py-0.5 font-medium text-foreground">
        {tf("applied", { filters: items.join(" · ") })}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="foco-etiqueta rounded-etiqueta px-1 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-[120ms] hover:decoration-foreground"
      >
        {tf("clear")}
      </button>
    </div>
  );
}
