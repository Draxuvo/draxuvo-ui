"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { reportsService } from "@/services/reports";
import { formatCurrency } from "@/lib/reports/format";
import { ORDER_STATUS_COLORS, REPORT_COLORS } from "@/lib/reports/colors";
import { variation } from "@/lib/reports/variation";
import { useReportModules } from "@/hooks/use-report-modules";
import { useChartColors } from "@/components/dashboard/chart-legend-links";
import { BarsChart, DonutChart } from "./charts";
import { ChartFrame } from "./chart-frame";
import { DeltaBadge } from "./delta-badge";
import { ReportState } from "./report-state";
import { StatTile } from "./stat-tile";
import type { TabProps } from "./tab-props";

export function SummaryTab({ period, companyId }: TabProps) {
  const t = useTranslations("reports");
  const tOrders = useTranslations("workOrders");
  const locale = useLocale();
  const colors = useChartColors();
  const modules = useReportModules();
  const { range, compare } = period;

  const query = useQuery({
    queryKey: ["reports", "summary", range.from, range.to, compare, companyId],
    queryFn: () => reportsService.summary(range, compare, companyId),
    placeholderData: keepPreviousData,
  });
  const s = query.data;
  const money = (v: number) => formatCurrency(v, locale);
  const previous = compare ? s?.previous : undefined;

  const statuses = Object.entries(s?.work_orders?.by_status ?? {}).map(([key, value]) => ({
    key,
    label: tOrders(`statuses.${key}`),
    value,
  }));
  const expenseSlices = [
    { id: "payroll", label: t("expenses.payroll"), value: s?.expenses?.payroll ?? 0, color: colors[REPORT_COLORS.payroll] },
    { id: "inventory", label: t("expenses.inventory"), value: s?.expenses?.inventory_cost ?? 0, color: colors[REPORT_COLORS.inventory] },
  ].filter((x) => x.value > 0);

  // Solo cuentan los bloques que el plan incluye: sin ellos no hay ceros que decidan si está vacío.
  const isEmpty =
    !!s &&
    (s.income?.total_revenue ?? 0) === 0 &&
    (s.income?.pending_revenue ?? 0) === 0 &&
    (s.work_orders?.total ?? 0) === 0 &&
    (s.expenses?.total ?? 0) === 0 &&
    (s.attendance?.total ?? 0) === 0 &&
    (s.inventory?.counted_products ?? 0) === 0;

  return (
    <ReportState
      isLoading={query.isLoading}
      isError={query.isError}
      hasData={!!s}
      isEmpty={isEmpty}
      onRetry={() => query.refetch()}
      period={period}
      skeleton={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-etiqueta bg-muted" />)}</div>}
    >
      {s && (
        <>
          {s.income ? (
            <StatTile hero label={t("summary.collected")} value={money(s.income.total_revenue)}>
              <p>{t("summary.collectedHint", { count: s.income.tickets_paid })}</p>
              {previous?.income && <DeltaBadge value={variation(s.income.total_revenue, previous.income.total_revenue, "up")} className="mt-1" />}
            </StatTile>
          ) : (
            s.expenses && (
              <StatTile hero label={t("summary.spent")} value={money(s.expenses.total)}>
                <p>{t("summary.expensesHint")}</p>
                {previous?.expenses && <DeltaBadge value={variation(s.expenses.total, previous.expenses.total, "down")} className="mt-1" />}
              </StatTile>
            )
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {s.income && (
              <StatTile label={t("summary.pending")} value={money(s.income.pending_revenue)}>
                {t("summary.pendingHint", { count: s.income.tickets_pending })}
              </StatTile>
            )}
            {s.income && s.expenses && (
              <StatTile label={t("summary.expenses")} value={money(s.expenses.total)}>
                <p>{t("summary.expensesHint")}</p>
                {previous?.expenses && <DeltaBadge value={variation(s.expenses.total, previous.expenses.total, "down")} className="mt-1" />}
              </StatTile>
            )}
            {s.inventory && (
              <>
                <StatTile label={t("summary.inventoryValue")} value={money(s.inventory.value)}>
                  {t("summary.inventoryHint", { count: s.inventory.counted_products })}
                </StatTile>
                <StatTile label={t("summary.lowStock")} value={s.inventory.low_stock}>
                  {t("summary.lowStockHint")}
                </StatTile>
              </>
            )}
            {modules.workOrders && s.work_orders && (
              <StatTile label={t("summary.orders")} value={s.work_orders.total}>
                {t("summary.billed")}: {money(s.work_orders.total_billed)}
              </StatTile>
            )}
            {modules.attendance && s.attendance && <StatTile label={t("summary.attendance")} value={s.attendance.total} />}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {modules.workOrders && s.work_orders && s.work_orders.total > 0 && (
              <ChartFrame title={t("summary.ordersChart")} rows={statuses.map((x) => ({ label: x.label, value: String(x.value) }))} height={220}>
                <BarsChart
                  data={statuses.map((x) => ({ status: x.label, key: x.key, value: x.value }))}
                  indexBy="status"
                  keys={["value"]}
                  colorFor={(_, row) => colors[ORDER_STATUS_COLORS[String(row.key)] ?? 5]}
                  format={(v) => String(v)}
                  integerAxis
                />
              </ChartFrame>
            )}
            {expenseSlices.length > 0 && (
              <ChartFrame title={t("summary.expensesChart")} rows={expenseSlices.map((x) => ({ label: x.label, value: money(x.value) }))} height={220}>
                <DonutChart slices={expenseSlices} format={money} />
              </ChartFrame>
            )}
          </div>
        </>
      )}
    </ReportState>
  );
}
