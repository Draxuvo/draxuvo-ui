"use client";
// Marco accesible de una gráfica (FR-013): título, la gráfica con descripción para lector de pantalla y una
// tabla con todos sus valores dentro de "Ver datos", navegable con teclado.
import { useTranslations } from "next-intl";
import { CARD } from "./styles";

export interface ChartRow {
  label: string;
  value: string;
}

interface ChartFrameProps {
  title: string;
  rows: ChartRow[];
  height?: number;
  children: React.ReactNode;
}

export function ChartFrame({ title, rows, height = 240, children }: ChartFrameProps) {
  const t = useTranslations("reports.chart");
  const description = t("label", { title, values: rows.map((r) => `${r.label} ${r.value}`).join(", ") });

  return (
    <figure className={CARD}>
      <figcaption className="mb-4 text-sm font-semibold text-foreground">{title}</figcaption>
      <div role="img" aria-label={description} style={{ height }}>
        {children}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground foco-etiqueta">{t("viewData")}</summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 font-medium">{title}</th>
              <th scope="col" className="py-1 text-right font-medium">{t("value")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border/60">
                <th scope="row" className="py-1 text-left font-normal">{r.label}</th>
                <td className="py-1 text-right tabular-nums">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
