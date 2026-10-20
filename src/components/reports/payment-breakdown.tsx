"use client";
// Cobrado en el rango por método y, en tarjeta, por terminal (spec 015, US4): sirve para cuadrar cada terminal
// contra el reporte de su proveedor. Con el rango de hoy es el resumen del día.
import { useLocale, useTranslations } from "next-intl";
import type { IncomeReport } from "@/types";

export function PaymentBreakdown({ report }: { report?: IncomeReport }) {
  const t = useTranslations("reports.payments");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const byMethod = report?.by_method ?? [];
  const byTerminal = report?.by_terminal ?? [];
  if (byMethod.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={t("byMethod")}>
        {byMethod.map((row) => (
          <Line key={row.method} label={row.label} count={t("count", { count: row.count })} total={money.format(row.total)} />
        ))}
      </Card>
      <Card title={t("byTerminal")}>
        {byTerminal.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">{t("noCard")}</li>
        ) : (
          byTerminal.map((row) => (
            <Line
              key={row.terminal?.id ?? "none"}
              label={row.terminal?.name ?? t("noTerminal")}
              count={t("count", { count: row.count })}
              total={money.format(row.total)}
            />
          ))
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <h3 className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">{title}</h3>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function Line({ label, count, total }: { label: string; count: string; total: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="min-w-0">
        <span className="block truncate text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </span>
      <span className="font-semibold tabular-nums text-foreground">{total}</span>
    </li>
  );
}
