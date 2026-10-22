"use client";
// Cascarón de Reportes: pestañas, barra de periodo única y botón de actualizar. Cada pestaña vive en su archivo.
// Las pestañas salen de los módulos activos de la empresa (spec 033); la API sigue siendo la barrera.
import { useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReportModules } from "@/hooks/use-report-modules";
import { useReportPeriod } from "@/hooks/use-report-period";
import { ExpensesTab } from "./expenses-tab";
import { IncomeTab } from "./income-tab";
import { InventoryTab } from "./inventory-tab";
import { PayrollTab } from "./payroll-tab";
import { PeriodBar } from "./period-bar";
import { SummaryTab } from "./summary-tab";

type Tab = "summary" | "inventory" | "income" | "expenses" | "payroll";

const TABS: { key: Tab; label: "tabSummary" | "tabInventory" | "tabIncome" | "tabExpenses" | "tabPayroll" }[] = [
  { key: "summary", label: "tabSummary" },
  { key: "inventory", label: "tabInventory" },
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
    income: modules.income,
    expenses: modules.expenses,
    payroll: modules.attendance,
  };
  // Una pestaña que deja de estar disponible (cambió el plan o los módulos) cae en Resumen.
  const tab = available[selected] ? selected : "summary";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("tabsLabel")}>
        {TABS.filter(({ key }) => available[key]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-etiqueta border px-4 py-2 text-sm font-semibold foco-etiqueta transition-colors",
              tab === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t(label)}
          </button>
        ))}
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

      {tab === "summary" && <SummaryTab period={period} companyId={companyId} />}
      {tab === "inventory" && <InventoryTab period={period} companyId={companyId} />}
      {tab === "income" && <IncomeTab period={period} companyId={companyId} />}
      {tab === "expenses" && <ExpensesTab period={period} companyId={companyId} />}
      {tab === "payroll" && <PayrollTab period={period} companyId={companyId} />}
    </div>
  );
}
