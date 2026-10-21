"use client";
// Gráficas nivo de Reportes con el tema común. Cada barra lleva su valor escrito; las donas llevan su leyenda
// con valor y porcentaje (sin una segunda lista que repita lo mismo).
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { NIVO_THEME, TOOLTIP_STYLE } from "@/lib/reports/chart-theme";

type Row = Record<string, string | number>;

function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tinta o blanco, el que más contraste dé sobre el color de la barra (el valor va escrito dentro de ella). */
export function readableOn(color: string): string {
  const lum = luminance(color);
  if (lum === null) return "#141414";
  const onInk = (lum + 0.05) / (luminance("#141414")! + 0.05);
  const onWhite = 1.05 / (lum + 0.05);
  return onInk >= onWhite ? "#141414" : "#ffffff";
}

interface BarsProps {
  data: Row[];
  indexBy: string;
  keys: string[];
  colorFor: (key: string, row: Row) => string;
  format: (value: number) => string;
  /** Margen izquierdo para etiquetas de importes. */
  left?: number;
  integerAxis?: boolean;
}

export function BarsChart({ data, indexBy, keys, colorFor, format, left = 44, integerAxis = false }: BarsProps) {
  return (
    <ResponsiveBar<Row>
      data={data}
      keys={keys}
      indexBy={indexBy}
      margin={{ top: 16, right: 8, bottom: 36, left }}
      padding={data.length < 4 ? 0.6 : 0.35}
      borderRadius={4}
      colors={(bar) => colorFor(String(bar.id), bar.data)}
      theme={NIVO_THEME}
      axisBottom={{ tickSize: 0, tickPadding: 6 }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 6,
        format: (v) => (integerAxis && !Number.isInteger(Number(v)) ? "" : format(Number(v))),
      }}
      label={(d) => format(Number(d.value))}
      labelSkipWidth={36}
      labelSkipHeight={16}
      labelTextColor={(bar) => readableOn(String(bar.color))}
      tooltip={({ id, indexValue, value }) => (
        <div style={TOOLTIP_STYLE}>
          {keys.length > 1 ? `${id} · ` : ""}
          {indexValue}: <strong>{format(Number(value))}</strong>
        </div>
      )}
    />
  );
}

export interface Slice {
  id: string;
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ slices, format }: { slices: Slice[]; format: (value: number) => string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-center">
      <div className="h-44 min-w-0 flex-1">
        <ResponsivePie<Slice>
          data={slices}
          innerRadius={0.65}
          padAngle={2}
          colors={(d) => d.data.color}
          enableArcLinkLabels={false}
          enableArcLabels={false}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          theme={NIVO_THEME}
          tooltip={({ datum }) => (
            <div style={TOOLTIP_STYLE}>
              {datum.data.label}: <strong>{format(datum.value)}</strong>
            </div>
          )}
        />
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {format(s.value)}
              {total > 0 && <span className="ml-1 font-normal text-muted-foreground">({Math.round((s.value / total) * 100)}%)</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
