// CSV de las tablas de Reportes (specs/028-reportes-rediseno/research.md R6): comillas escapadas, CRLF y BOM
// UTF-8 para que Excel lea bien los acentos. Importes como número puro y fechas ISO, sin formato de pantalla.
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const BOM = "﻿";

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  // Un texto que empieza con = + - @ lo ejecutaría la hoja de cálculo como fórmula: se neutraliza.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

export function csvFilename(table: string, range: { from: string; to: string }): string {
  return `reportes-${table}-${range.from}_${range.to}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
