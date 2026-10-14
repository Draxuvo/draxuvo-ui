"use client";
// src/components/dashboard/chart-legend-links.tsx
// Leyenda navegable bajo cada gráfica (contracts/ui-routes.md): cada concepto es un <Link>
// real con su conteo, enfocable con Tab y abre con Enter. Las barras y rebanadas de nivo
// navegan al mismo href con onClick; esta leyenda es el camino accesible.
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Colores de gráfica de DESIGN.md: tinta, oferta, sello, ceja y gris. */
export type ChartColor = 1 | 2 | 3 | 4 | 5;

const SWATCH: Record<ChartColor, string> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
};

// Respaldo para el render del servidor; en el cliente se leen las variables de globals.css.
const FALLBACK = "#141414|#ff5a1f|#0b7a4b|#ffd23f|#6b7280";

function readChartColors() {
  const style = getComputedStyle(document.documentElement);
  const values = ([1, 2, 3, 4, 5] as const).map((n) => style.getPropertyValue(`--chart-${n}`).trim());
  return values.every(Boolean) ? values.join("|") : FALLBACK;
}

const noopSubscribe = () => () => {};

/**
 * Colores `--chart-1..5` resueltos para nivo (que pinta SVG y anima colores, así que
 * necesita valores, no `var()`).
 */
export function useChartColors(): Record<ChartColor, string> {
  const joined = useSyncExternalStore(noopSubscribe, readChartColors, () => FALLBACK);
  const [c1, c2, c3, c4, c5] = joined.split("|");
  return { 1: c1, 2: c2, 3: c3, 4: c4, 5: c5 };
}

export interface LegendItem {
  /** Clave cruda de la API (status, priority, type…). */
  key: string;
  label: string;
  count: number;
  /** Texto en lugar del conteo (por ejemplo una cifra en pesos). */
  display?: string;
  color: ChartColor;
  /** Sin href se muestra sin enlace. */
  href?: string;
  ariaLabel?: string;
}

export function ChartLegendLinks({
  items,
  label,
  className,
}: {
  items: LegendItem[];
  /** Nombre accesible de la lista, por ejemplo "Leyenda: Órdenes por estado". */
  label: string;
  className?: string;
}) {
  return (
    <ul aria-label={label} className={cn("divide-y divide-border", className)}>
      {items.map((item) => {
        const content = (
          <>
            <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", SWATCH[item.color])} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="font-display text-lg font-semibold leading-none tabular-nums">
              {item.display ?? item.count}
            </span>
            {item.href && (
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className="shrink-0 text-muted-foreground transition-colors duration-[120ms] group-hover:text-foreground"
              />
            )}
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link
                href={item.href}
                aria-label={item.ariaLabel}
                className="group -mx-2 flex min-h-10 items-center gap-3 rounded-[6px] px-2 text-sm transition-colors duration-[120ms] ease-etiqueta hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-foreground"
              >
                {content}
              </Link>
            ) : (
              <div className="flex min-h-10 items-center gap-3 text-sm text-muted-foreground">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
