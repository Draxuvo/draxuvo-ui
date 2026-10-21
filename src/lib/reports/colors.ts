// Un color por concepto en todo Reportes (FR-014): "cobrado" es el mismo en Resumen, Ingresos y sus leyendas.
import type { ChartColor } from "@/components/dashboard/chart-legend-links";

export const REPORT_COLORS = {
  collected: 3,
  pending: 4,
  payroll: 2,
  inventory: 5,
} as const satisfies Record<string, ChartColor>;

export const ORDER_STATUS_COLORS: Record<string, ChartColor> = {
  open: 4,
  in_progress: 2,
  done: 5,
  paid: 3,
  cancelled: 1,
};
