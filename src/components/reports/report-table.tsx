// Tabla de un reporte: encabezado con título y acciones (exportar), filas y fila de total opcional.
import { cn } from "@/lib/utils";
import { CARD } from "./styles";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** Celda de la fila de total. */
  total?: React.ReactNode;
  className?: string;
}

interface ReportTableProps<T> {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  totalLabel?: string;
  empty: string;
}

export function ReportTable<T>({ title, subtitle, actions, columns, rows, rowKey, totalLabel, empty }: ReportTableProps<T>) {
  const hasTotal = !!totalLabel && columns.some((c) => c.total !== undefined);
  return (
    <section className={cn(CARD, "overflow-hidden p-0")}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn("px-5 py-3 font-medium", c.align === "right" ? "text-right" : "text-left")}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-muted/50">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-5 py-3 tabular-nums", c.align === "right" && "text-right", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasTotal && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/50 font-semibold">
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn("px-5 py-3 tabular-nums", c.align === "right" && "text-right")}>
                      {i === 0 ? totalLabel : c.total}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
