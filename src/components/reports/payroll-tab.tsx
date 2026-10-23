"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { reportsService } from "@/services/reports";
import { formatCurrency } from "@/lib/reports/format";
import type { PayrollEmployee } from "@/types";
import type { CsvColumn } from "@/lib/reports/csv";
import { ExportCsvButton } from "./export-csv-button";
import { ReportState } from "./report-state";
import { ReportTable, type Column } from "./report-table";
import type { TabProps } from "./tab-props";

// Sin retardos ni faltas: no hay horario y siempre valdrían cero (spec 028, aclaración 1).
export function PayrollTab({ period, companyId }: TabProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const { range } = period;

  const query = useQuery({
    queryKey: ["reports", "payroll", range.from, range.to, companyId],
    queryFn: () => reportsService.payroll(range, companyId),
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const rows = report?.employees ?? [];
  const hours = (e: PayrollEmployee) => e.hours_worked.toFixed(1);
  const unit = <span className="text-xs text-muted-foreground"> {t("payroll.hoursUnit")}</span>;

  const columns: Column<PayrollEmployee>[] = [
    { key: "name", header: t("payroll.colName"), render: (e) => <span className="font-medium">{e.name}</span> },
    { key: "salary", header: t("payroll.colSalary"), align: "right", render: (e) => formatCurrency(e.salary, locale, true), total: formatCurrency(report?.total_payroll ?? 0, locale, true) },
    { key: "days", header: t("payroll.colDays"), align: "right", render: (e) => e.days_present, total: rows.reduce((s, e) => s + e.days_present, 0) },
    {
      key: "hours",
      header: t("payroll.colHours"),
      align: "right",
      render: (e) => <>{hours(e)}{unit}</>,
      total: <>{rows.reduce((s, e) => s + e.hours_worked, 0).toFixed(1)}{unit}</>,
    },
  ];
  const csvColumns: CsvColumn<PayrollEmployee>[] = [
    { header: t("payroll.colName"), value: (e) => e.name },
    { header: t("payroll.colSalary"), value: (e) => e.salary },
    { header: t("payroll.colDays"), value: (e) => e.days_present },
    { header: t("payroll.colHours"), value: (e) => Number(hours(e)) },
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
      {report && report.runs.count > 0 && (
        <dl className="mb-4 grid gap-3 sm:grid-cols-3" aria-label={t("payroll.runsLabel")}>
          <RunStat label={t("payroll.runsPaid")} value={formatCurrency(report.runs.paid_cents / 100, locale, true)} />
          <RunStat label={t("payroll.runsPending")} value={formatCurrency(report.runs.pending_cents / 100, locale, true)} />
          <RunStat label={t("payroll.runsCount")} value={String(report.runs.count)} />
        </dl>
      )}
      <ReportTable
        title={t("payroll.title")}
        subtitle={t("payroll.subtitle")}
        actions={<ExportCsvButton table={t("payroll.table")} range={range} columns={csvColumns} rows={rows} />}
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        totalLabel={t("total")}
        empty={t("state.emptyTitle")}
      />
    </ReportState>
  );
}

function RunStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-etiqueta border border-border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
