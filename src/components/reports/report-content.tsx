"use client";
// Cascarón de Reportes: pestañas, barra de periodo única y botón de actualizar. Cada pestaña vive en su archivo.
// Las pestañas salen de los módulos activos de la empresa (spec 033); la API sigue siendo la barrera.
import { useState, type KeyboardEvent } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportModules } from "@/hooks/use-report-modules";
import { useReportPeriod } from "@/hooks/use-report-period";
import { ExpensesTab } from "./expenses-tab";
import { IncomeTab } from "./income-tab";
import { InventoryTab } from "./inventory-tab";
import { PayrollTab } from "./payroll-tab";
import { PeriodBar } from "./period-bar";
import { SalesTab } from "./sales-tab";
import { SummaryTab } from "./summary-tab";

type Tab = "summary" | "inventory" | "sales" | "income" | "expenses" | "payroll";

const TABS: { key: Tab; label: "tabSummary" | "tabInventory" | "tabSales" | "tabIncome" | "tabExpenses" | "tabPayroll" }[] = [
  { key: "summary", label: "tabSummary" },
  { key: "inventory", label: "tabInventory" },
  { key: "sales", label: "tabSales" },
  { key: "income", label: "tabIncome" },
  { key: "expenses", label: "tabExpenses" },
  { key: "payroll", label: "tabPayroll" },
];

export function ReportContent({ companyId }: { companyId?: number }) {
  const t = useTranslations("reports");
  const period = useReportPeriod();
  const modules = useReportModules();
  const [selected, setTab] = useState<Tab>("summary");
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["reports"] }) > 0;

  const available: Record<Tab, boolean> = {
    summary: true,
    inventory: modules.inventory,
    sales: modules.pos,
    income: modules.income,
    expenses: modules.expenses,
    payroll: modules.attendance,
  };
  // Una pestaña que deja de estar disponible (cambió el plan o los módulos) cae en Resumen.
  const tab = available[selected] ? selected : "summary";

  const visible = TABS.filter(({ key }) => available[key]);

  // ← → recorren las pestañas en círculo; Inicio y Fin saltan a la primera y a la última, y el foco las sigue.
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = visible.findIndex(({ key }) => key === tab);
    const target =
      event.key === "ArrowRight" ? (index + 1) % visible.length
      : event.key === "ArrowLeft" ? (index - 1 + visible.length) % visible.length
      : event.key === "Home" ? 0
      : event.key === "End" ? visible.length - 1
      : null;
    if (target === null || index < 0) return;
    event.preventDefault();
    const next = visible[target].key;
    setTab(next);
    document.getElementById(`reports-tab-${next}`)?.focus();
  }

  // Hasta conocer los módulos del plan no se pintan pestañas que quizá no le tocan (spec 052, H-43).
  if (modules.loading) return <Skeleton className="h-64 w-full rounded-etiqueta" aria-busy="true" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {/* Pestañas con rol (spec 054, H-52): se anuncian como pestañas y se recorren con ← → Inicio Fin. */}
        <div role="tablist" aria-label={t("tabsLabel")} className="flex flex-wrap items-center gap-2" onKeyDown={onTabKeyDown}>
          {visible.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`reports-tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`reports-panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-etiqueta border px-4 py-2 text-sm font-semibold foco-etiqueta transition-colors",
                tab === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={t("refresh")}
          title={t("refresh")}
          disabled={fetching}
          onClick={() => queryClient.invalidateQueries({ queryKey: ["reports"] })}
          className="ml-auto rounded-etiqueta p-2 text-muted-foreground foco-etiqueta hover:bg-muted hover:text-foreground disabled:pointer-events-none"
        >
          <RefreshCw size={16} aria-hidden className={fetching ? "animate-spin" : ""} />
        </button>
      </div>

      <PeriodBar period={period} showCompare={tab === "summary"} />

      <div role="tabpanel" id={`reports-panel-${tab}`} aria-labelledby={`reports-tab-${tab}`}>
        {tab === "summary" && <SummaryTab period={period} companyId={companyId} />}
        {tab === "inventory" && <InventoryTab period={period} companyId={companyId} />}
        {tab === "sales" && <SalesTab period={period} companyId={companyId} />}
        {tab === "income" && <IncomeTab period={period} companyId={companyId} />}
        {tab === "expenses" && <ExpensesTab period={period} companyId={companyId} />}
        {tab === "payroll" && <PayrollTab period={period} companyId={companyId} />}
      </div>
    </div>
  );
}
