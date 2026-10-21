"use client";
// "Exportar CSV" de una tabla (FR-011, FR-012): descarga solo esa tabla con el periodo vigente; con la tabla
// vacía queda deshabilitado.
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from "@/lib/reports/csv";

interface ExportCsvButtonProps<T> {
  /** Nombre corto de la tabla (para el archivo y el nombre accesible). */
  table: string;
  range: { from: string; to: string };
  columns: CsvColumn<T>[];
  rows: T[];
}

export function ExportCsvButton<T>({ table, range, columns, rows }: ExportCsvButtonProps<T>) {
  const t = useTranslations("reports.export");
  const disabled = rows.length === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? t("empty") : undefined}
      aria-label={t("csvFor", { table })}
      onClick={() => downloadCsv(csvFilename(table, range), toCsv(columns, rows))}
      className="inline-flex items-center gap-1.5 rounded-etiqueta border border-border px-3 py-1.5 text-sm font-medium text-foreground foco-etiqueta enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download size={14} aria-hidden />
      {t("csv")}
    </button>
  );
}
