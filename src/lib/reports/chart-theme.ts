// Tema común de las gráficas nivo de Reportes y su tooltip (DESIGN.md: tokens por variable CSS).
import type { CSSProperties } from "react";

export const NIVO_THEME = {
  axis: {
    ticks: { text: { fontSize: 11, fill: "var(--muted-foreground)" }, line: { strokeWidth: 0 } },
    domain: { line: { strokeWidth: 0 } },
  },
  grid: { line: { stroke: "var(--border)" } },
  labels: { text: { fontSize: 11, fontWeight: 600, fill: "var(--foreground)" } },
} as const;

export const TOOLTIP_STYLE: CSSProperties = {
  padding: "6px 10px",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--foreground)",
  boxShadow: "0 1px 0 rgba(20,20,20,0.08), 0 2px 6px rgba(20,20,20,0.06)",
};
