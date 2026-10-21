"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { reportsService } from "@/services/reports";
import { groupByFor } from "@/lib/reports/period";
import { formatCurrency, formatDay, periodLabel } from "@/lib/reports/format";
import { REPORT_COLORS } from "@/lib/reports/colors";
import { useChartColors } from "@/components/dashboard/chart-legend-links";
import type { IncomeBreakdownRow } from "@/types";
import type { CsvColumn } from "@/lib/reports/csv";
import { BarsChart } from "./charts";
import { ChartFrame } from "./chart-frame";
import { ExportCsvButton } from "./export-csv-button";
import { PaymentBreakdown } from "./payment-breakdown";
import { ReportState } from "./report-state";
import { ReportTable, type Column } from "./report-table";
import type { TabProps } from "./tab-props";

export function IncomeTab({ period, companyId }: TabProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const colors = useChartColors();
  const { range } = period;
  const groupBy = groupByFor(range);

  const query = useQuery({
    queryKey: ["reports", "income", range.from, range.to, groupBy, companyId],
    queryFn: () => reportsService.income(range, groupBy, companyId),
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const rows = report?.breakdown ?? [];
  const money = (v: number) => formatCurrency(v, locale);
  const cents = (v: number) => formatCurrency(v, locale, true);
  const chartRows = (report?.by_period ?? []).map((g) => ({ label: periodLabel(g.period, locale), value: money(g.revenue) }));

  const columns: Column<IncomeBreakdownRow>[] = [
    { key: "folio", header: t("income.colFolio"), render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.folio}</span> },
    { key: "order", header: t("income.colWorkOrder"), render: (r) => r.work_order.title },
    { key: "employee", header: t("income.colEmployee"), render: (r) => <span className="text-muted-foreground">{r.work_order.employee ?? t("income.unassigned")}</span> },
    { key: "total", header: t("income.colTotal"), align: "right", render: (r) => <span className="font-medium">{cents(r.total)}</span>, total: cents(report?.total_revenue ?? 0) },
    { key: "date", header: t("income.colDate"), align: "right", render: (r) => <span className="text-muted-foreground">{formatDay(r.paid_at, locale)}</span> },
  ];
  const csvColumns: CsvColumn<IncomeBreakdownRow>[] = [
    { header: t("income.colFolio"), value: (r) => r.folio },
    { header: t("income.colWorkOrder"), value: (r) => r.work_order.title },
    { header: t("income.colEmployee"), value: (r) => r.work_order.employee ?? "" },
    { header: t("income.colTotal"), value: (r) => r.total },
    { header: t("income.colDate"), value: (r) => r.paid_at.slice(0, 10) },
  ];

  return (
    <ReportState
      isLoading={query.isLoading}
      isError={query.isError}
      hasData={!!report}
      isEmpty={!!report && rows.length === 0}
      onRetry={() => query.refetch()}
      period={period}
    >
      <PaymentBreakdown report={report} />
      <ChartFrame title={t("income.chartTitle")} rows={chartRows}>
        <BarsChart
          data={(report?.by_period ?? []).map((g) => ({ period: periodLabel(g.period, locale), revenue: g.revenue }))}
          indexBy="period"
          keys={["revenue"]}
          colorFor={() => colors[REPORT_COLORS.collected]}
          format={money}
          left={72}
        />
      </ChartFrame>
      <ReportTable
        title={t("income.tableTitle")}
        actions={<ExportCsvButton table={t("income.table")} range={range} columns={csvColumns} rows={rows} />}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        totalLabel={t("total")}
        empty={t("state.emptyTitle")}
      />
    </ReportState>
  );
}
