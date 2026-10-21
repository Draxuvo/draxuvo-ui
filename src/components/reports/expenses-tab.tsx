"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { reportsService } from "@/services/reports";
import { groupByFor } from "@/lib/reports/period";
import { formatCurrency, periodLabel } from "@/lib/reports/format";
import { REPORT_COLORS } from "@/lib/reports/colors";
import { useChartColors } from "@/components/dashboard/chart-legend-links";
import type { ExpensesReport } from "@/types";
import type { CsvColumn } from "@/lib/reports/csv";
import { BarsChart } from "./charts";
import { ChartFrame } from "./chart-frame";
import { ExportCsvButton } from "./export-csv-button";
import { ReportState } from "./report-state";
import { ReportTable, type Column } from "./report-table";
import type { TabProps } from "./tab-props";

type Employee = ExpensesReport["payroll"]["employees"][number];
type Movement = ExpensesReport["inventory_cost"]["movements"][number];

export function ExpensesTab({ period, companyId }: TabProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const colors = useChartColors();
  const { range } = period;
  const groupBy = groupByFor(range);

  const query = useQuery({
    queryKey: ["reports", "expenses", range.from, range.to, groupBy, companyId],
    queryFn: () => reportsService.expenses(range, groupBy, companyId),
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const employees = report?.payroll.employees ?? [];
  const movements = report?.inventory_cost.movements ?? [];
  const money = (v: number) => formatCurrency(v, locale);
  const cents = (v: number) => formatCurrency(v, locale, true);
  const byPeriod = (report?.inventory_cost.by_period ?? []).map((g) => ({ period: periodLabel(g.period, locale), cost: g.cost }));

  const payrollColumns: Column<Employee>[] = [
    { key: "name", header: t("expenses.colEmployee"), render: (e) => e.name },
    { key: "salary", header: t("expenses.colSalary"), align: "right", render: (e) => <span className="font-medium">{cents(e.salary)}</span>, total: cents(report?.payroll.total ?? 0) },
  ];
  const inventoryColumns: Column<Movement>[] = [
    {
      key: "product",
      header: t("expenses.colProduct"),
      render: (m) => (
        <>
          <p>{m.product_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{m.sku}</p>
        </>
      ),
    },
    { key: "qty", header: t("expenses.colQty"), align: "right", render: (m) => m.qty },
    { key: "unit", header: t("expenses.colUnitCost"), align: "right", render: (m) => cents(m.unit_cost) },
    { key: "cost", header: t("expenses.colTotalCost"), align: "right", render: (m) => <span className="font-medium">{cents(m.cost)}</span>, total: cents(report?.inventory_cost.total ?? 0) },
  ];
  const payrollCsv: CsvColumn<Employee>[] = [
    { header: t("expenses.colEmployee"), value: (e) => e.name },
    { header: t("expenses.colSalary"), value: (e) => e.salary },
  ];
  const inventoryCsv: CsvColumn<Movement>[] = [
    { header: t("expenses.colDate"), value: (m) => m.created_at.slice(0, 10) },
    { header: t("expenses.colProduct"), value: (m) => m.product_name },
    { header: t("expenses.colSku"), value: (m) => m.sku },
    { header: t("expenses.colQty"), value: (m) => m.qty },
    { header: t("expenses.colUnitCost"), value: (m) => m.unit_cost },
    { header: t("expenses.colTotalCost"), value: (m) => m.cost },
  ];

  return (
    <ReportState
      isLoading={query.isLoading}
      isError={query.isError}
      hasData={!!report}
      isEmpty={!!report && employees.length === 0 && movements.length === 0}
      onRetry={() => query.refetch()}
      period={period}
    >
      {byPeriod.length > 0 && (
        <ChartFrame title={t("expenses.chartTitle")} rows={byPeriod.map((g) => ({ label: g.period, value: money(g.cost) }))}>
          <BarsChart data={byPeriod} indexBy="period" keys={["cost"]} colorFor={() => colors[REPORT_COLORS.inventory]} format={money} left={72} />
        </ChartFrame>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ReportTable
          title={t("expenses.payrollTitle")}
          subtitle={t("expenses.payrollNote")}
          actions={<ExportCsvButton table={t("expenses.payrollTable")} range={range} columns={payrollCsv} rows={employees} />}
          columns={payrollColumns}
          rows={employees}
          rowKey={(e) => e.id}
          totalLabel={t("total")}
          empty={t("state.emptyTitle")}
        />
        <ReportTable
          title={t("expenses.inventoryTitle")}
          actions={<ExportCsvButton table={t("expenses.inventoryTable")} range={range} columns={inventoryCsv} rows={movements} />}
          columns={inventoryColumns}
          rows={movements}
          rowKey={(m) => m.id}
          totalLabel={t("total")}
          empty={t("state.emptyTitle")}
        />
      </div>
    </ReportState>
  );
}
