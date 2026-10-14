"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import {
  DollarSign,
  TrendingDown,
  ClipboardList,
  UserCheck,
  RefreshCw,
  FileBarChart2,
} from "lucide-react";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useChartColors, type ChartColor } from "@/components/dashboard/chart-legend-links";
import { reportsService, type ReportPeriod, type GroupBy } from "@/services/reports";

const today = new Date().toISOString().split("T")[0];
const firstOfMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
)
  .toISOString()
  .split("T")[0];

type Tab = "summary" | "income" | "expenses" | "payroll";

const PERIODS: ReportPeriod[] = ["weekly", "monthly", "annual"];
const GROUP_BYS: GroupBy[] = ["week", "month", "year"];

const NIVO_THEME = {
  axis: {
    ticks: {
      text: { fontSize: 11, fill: "var(--muted-foreground)" },
      line: { strokeWidth: 0 },
    },
    domain: { line: { strokeWidth: 0 } },
  },
  grid: { line: { stroke: "var(--border)" } },
} as const;

const tooltipStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const STATUS_COLORS: Record<string, ChartColor> = {
  pending: 4,
  in_progress: 2,
  in_review: 5,
  completed: 3,
  cancelled: 1,
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(v);
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center mb-3",
          iconBg,
        )}
      >
        <Icon size={16} className={iconColor} />
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <p className="text-sm font-medium text-foreground mb-4">{title}</p>
      {children}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-muted mb-3" />
      <div className="h-7 w-20 bg-muted rounded mb-1" />
      <div className="h-3 w-28 bg-muted rounded" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
      {children}
    </h2>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

interface ReportContentProps {
  companyId?: number;
}

export function ReportContent({ companyId }: ReportContentProps) {
  const t = useTranslations("reports");
  const chartColors = useChartColors();
  const tWO = useTranslations("analyticsBoard");
  const locale = useLocale();
  const dateLocale = locale === "es" ? es : enUS;

  const [tab, setTab] = useState<Tab>("summary");

  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [summaryDate, setSummaryDate] = useState(today);

  const [incomeFrom, setIncomeFrom] = useState(firstOfMonth);
  const [incomeTo, setIncomeTo] = useState(today);
  const [incomeGroupBy, setIncomeGroupBy] = useState<GroupBy>("month");

  const [expensesFrom, setExpensesFrom] = useState(firstOfMonth);
  const [expensesTo, setExpensesTo] = useState(today);
  const [expensesGroupBy, setExpensesGroupBy] = useState<GroupBy>("month");

  const [payrollFrom, setPayrollFrom] = useState(firstOfMonth);
  const [payrollTo, setPayrollTo] = useState(today);

  const summaryQuery = useQuery({
    queryKey: ["reports-summary", period, summaryDate, companyId],
    queryFn: () => reportsService.summary(period, summaryDate, companyId),
    enabled: tab === "summary",
  });

  const incomeQuery = useQuery({
    queryKey: ["reports-income", incomeFrom, incomeTo, incomeGroupBy, companyId],
    queryFn: () =>
      reportsService.income(incomeFrom, incomeTo, incomeGroupBy, companyId),
    enabled: tab === "income",
  });

  const expensesQuery = useQuery({
    queryKey: ["reports-expenses", expensesFrom, expensesTo, expensesGroupBy, companyId],
    queryFn: () =>
      reportsService.expenses(expensesFrom, expensesTo, expensesGroupBy, companyId),
    enabled: tab === "expenses",
  });

  const payrollQuery = useQuery({
    queryKey: ["reports-payroll", payrollFrom, payrollTo, companyId],
    queryFn: () => reportsService.payroll(payrollFrom, payrollTo, companyId),
    enabled: tab === "payroll",
  });

  const activeIsFetching =
    (tab === "summary" && summaryQuery.isFetching) ||
    (tab === "income" && incomeQuery.isFetching) ||
    (tab === "expenses" && expensesQuery.isFetching) ||
    (tab === "payroll" && payrollQuery.isFetching);

  function handleRefetch() {
    if (tab === "summary") summaryQuery.refetch();
    else if (tab === "income") incomeQuery.refetch();
    else if (tab === "expenses") expensesQuery.refetch();
    else payrollQuery.refetch();
  }

  const summary = summaryQuery.data;

  const workOrderStatusData = summary
    ? Object.entries(summary.work_orders?.by_status ?? {}).map(([key, val]) => ({
        name: tWO(`workOrderStatuses.${key}`),
        value: val,
        fill: chartColors[STATUS_COLORS[key] ?? 5],
      }))
    : [];

  const incomeChartData = [
    {
      name: t("income.paid"),
      value: summary?.income.paid_revenue ?? 0,
      fill: chartColors[3],
    },
    {
      name: t("income.pending"),
      value: summary?.income.pending_revenue ?? 0,
      fill: chartColors[4],
    },
  ];

  const expenseChartData = [
    {
      name: t("expenses.payroll"),
      value: summary?.expenses.payroll_total ?? 0,
      fill: chartColors[2],
    },
    {
      name: t("expenses.inventory"),
      value: summary?.expenses.inventory_cost ?? 0,
      fill: chartColors[5],
    },
  ];

  const attendanceData = [
    {
      name: t("attendance.normal"),
      value: summary?.attendance.normal ?? 0,
      fill: chartColors[3],
    },
    {
      name: t("attendance.late"),
      value: summary?.attendance.late ?? 0,
      fill: chartColors[4],
    },
    {
      name: t("attendance.absent"),
      value: summary?.attendance.absent ?? 0,
      fill: chartColors[1],
    },
  ];

  const incomeGroups = (
    Array.isArray(incomeQuery.data?.groups) ? incomeQuery.data!.groups : []
  ).map((g) => ({ ...g, displayPeriod: g.period }));

  const expenseGroups = (
    Array.isArray(expensesQuery.data?.groups) ? expensesQuery.data!.groups : []
  ).map((g) => ({ ...g, displayPeriod: g.period }));

  const payrollEmployees = Array.isArray(payrollQuery.data?.employees)
    ? payrollQuery.data!.employees
    : [];

  const expensePayrollList = Array.isArray(expensesQuery.data?.payroll)
    ? expensesQuery.data!.payroll
    : [];

  const inventoryMovements = Array.isArray(expensesQuery.data?.inventory_movements)
    ? expensesQuery.data!.inventory_movements
    : [];

  const incomeTickets = Array.isArray(incomeQuery.data?.tickets)
    ? incomeQuery.data!.tickets
    : [];

  const TABS: { key: Tab; label: string }[] = [
    { key: "summary", label: t("tabSummary") },
    { key: "income", label: t("tabIncome") },
    { key: "expenses", label: t("tabExpenses") },
    { key: "payroll", label: t("tabPayroll") },
  ];

  return (
    <div className="space-y-6">
      {/* Tab navigation + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "text-sm px-4 py-2 rounded-lg border font-medium transition-colors",
              tab === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-border hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <button
          onClick={handleRefetch}
          disabled={activeIsFetching}
          className="ml-auto p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:pointer-events-none"
        >
          <RefreshCw
            size={16}
            className={activeIsFetching ? "animate-spin" : ""}
          />
        </button>
      </div>

      {/* ── RESUMEN ── */}
      {tab === "summary" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    period === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-border",
                  )}
                >
                  {t(
                    `period${p.charAt(0).toUpperCase()}${p.slice(1)}` as Parameters<typeof t>[0],
                  )}
                </button>
              ))}
            </div>
            <DateInput
              label={t("date")}
              value={summaryDate}
              onChange={setSummaryDate}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard
                  label={t("income.paid")}
                  value={formatCurrency(summary?.income.paid_revenue ?? 0)}
                  sub={`${t("income.pending")}: ${formatCurrency(summary?.income.pending_revenue ?? 0)}`}
                  icon={DollarSign}
                  iconColor="text-estado-completada-foreground"
                  iconBg="bg-estado-completada"
                />
                <StatCard
                  label={t("workOrders.total")}
                  value={summary?.work_orders.total ?? 0}
                  sub={`${t("workOrders.billed")}: ${formatCurrency(summary?.work_orders.total_billed ?? 0)}`}
                  icon={ClipboardList}
                  iconColor="text-estado-revision-foreground"
                  iconBg="bg-estado-revision"
                />
                <StatCard
                  label={t("expenses.total")}
                  value={formatCurrency(summary?.expenses.total ?? 0)}
                  sub={`${t("expenses.payroll")}: ${formatCurrency(summary?.expenses.payroll_total ?? 0)}`}
                  icon={TrendingDown}
                  iconColor="text-destructive"
                  iconBg="bg-destructive/10"
                />
                <StatCard
                  label={t("attendance.total")}
                  value={summary?.attendance.total ?? 0}
                  sub={`${t("attendance.late")}: ${summary?.attendance.late ?? 0} · ${t("attendance.absent")}: ${summary?.attendance.absent ?? 0}`}
                  icon={UserCheck}
                  iconColor="text-estado-revision-foreground"
                  iconBg="bg-estado-revision"
                />
              </>
            )}
          </div>

          <SectionTitle>{t("income.title")}</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("income.chartTitle")}>
              <div style={{ height: 220 }}>
                <ResponsivePie<{ id: string; value: number; color: string }>
                  data={incomeChartData.map((d) => ({
                    id: d.name,
                    value: d.value,
                    color: d.fill,
                  }))}
                  innerRadius={0.65}
                  padAngle={3}
                  colors={(d) => d.data.color}
                  enableArcLinkLabels={false}
                  enableArcLabels={false}
                  margin={{ top: 10, right: 10, bottom: 60, left: 10 }}
                  theme={NIVO_THEME}
                  legends={[
                    {
                      anchor: "bottom",
                      direction: "row",
                      itemWidth: 80,
                      itemHeight: 16,
                      itemsSpacing: 8,
                      symbolSize: 8,
                      symbolShape: "circle",
                      itemTextColor: "var(--muted-foreground)",
                    },
                  ]}
                  tooltip={({ datum }) => (
                    <div style={tooltipStyle}>
                      {datum.label}: <strong>{formatCurrency(datum.value)}</strong>
                    </div>
                  )}
                />
              </div>
            </ChartCard>

            <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-4 justify-center">
              <p className="text-sm font-medium text-foreground">
                {t("income.title")}
              </p>
              <div className="space-y-3">
                {[
                  {
                    label: t("income.paid"),
                    value: summary?.income.paid_revenue ?? 0,
                    color: "bg-estado-completada-border",
                  },
                  {
                    label: t("income.pending"),
                    value: summary?.income.pending_revenue ?? 0,
                    color: "bg-estado-pendiente-border",
                  },
                ].map(({ label, value, color }) => {
                  const total = summary?.income.total_revenue || 1;
                  const pct = Math.round((value / total) * 100);
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`}
                          />
                          <span className="text-sm text-muted-foreground">{label}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(value)}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {t("income.total")}
                  </span>
                  <span className="text-base font-semibold text-foreground">
                    {formatCurrency(summary?.income.total_revenue ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <SectionTitle>{t("workOrders.title")}</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("workOrders.chartTitle")}>
              <div style={{ height: 220 }}>
                <ResponsiveBar<{ name: string; value: number; fill: string }>
                  data={workOrderStatusData}
                  keys={["value"]}
                  indexBy="name"
                  margin={{ top: 10, right: 10, bottom: 36, left: 36 }}
                  padding={0.4}
                  borderRadius={4}
                  colors={(bar) => bar.data.fill}
                  theme={NIVO_THEME}
                  axisBottom={{ tickSize: 0, tickPadding: 5 }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 5,
                    format: (v) => (Number.isInteger(Number(v)) ? String(v) : ""),
                  }}
                  enableLabel={false}
                  tooltip={({ indexValue, value }) => (
                    <div style={tooltipStyle}>
                      {indexValue}: <strong>{value}</strong>
                    </div>
                  )}
                />
              </div>
            </ChartCard>

            <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-3 justify-center">
              <p className="text-sm font-medium text-foreground">
                {t("workOrders.title")}
              </p>
              {workOrderStatusData.map(({ name, value, fill }) => (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: fill }}
                    />
                    <span className="text-sm text-muted-foreground">{name}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {value}
                  </span>
                </div>
              ))}
              <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {t("workOrders.billed")}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(summary?.work_orders.total_billed ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <SectionTitle>{t("expenses.title")}</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("expenses.title")}>
              <div style={{ height: 220 }}>
                <ResponsivePie<{ id: string; value: number; color: string }>
                  data={expenseChartData.map((d) => ({
                    id: d.name,
                    value: d.value,
                    color: d.fill,
                  }))}
                  innerRadius={0.65}
                  padAngle={3}
                  colors={(d) => d.data.color}
                  enableArcLinkLabels={false}
                  enableArcLabels={false}
                  margin={{ top: 10, right: 10, bottom: 60, left: 10 }}
                  theme={NIVO_THEME}
                  legends={[
                    {
                      anchor: "bottom",
                      direction: "row",
                      itemWidth: 80,
                      itemHeight: 16,
                      itemsSpacing: 8,
                      symbolSize: 8,
                      symbolShape: "circle",
                      itemTextColor: "var(--muted-foreground)",
                    },
                  ]}
                  tooltip={({ datum }) => (
                    <div style={tooltipStyle}>
                      {datum.label}: <strong>{formatCurrency(datum.value)}</strong>
                    </div>
                  )}
                />
              </div>
            </ChartCard>

            <ChartCard title={t("attendance.title")}>
              <div style={{ height: 220 }}>
                <ResponsiveBar<{ name: string; value: number; fill: string }>
                  data={attendanceData}
                  keys={["value"]}
                  indexBy="name"
                  margin={{ top: 10, right: 10, bottom: 36, left: 36 }}
                  padding={0.35}
                  borderRadius={4}
                  colors={(bar) => bar.data.fill}
                  theme={NIVO_THEME}
                  axisBottom={{ tickSize: 0, tickPadding: 5 }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 5,
                    format: (v) => (Number.isInteger(Number(v)) ? String(v) : ""),
                  }}
                  enableLabel={false}
                  tooltip={({ indexValue, value }) => (
                    <div style={tooltipStyle}>
                      {indexValue}: <strong>{value}</strong>
                    </div>
                  )}
                />
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── INGRESOS ── */}
      {tab === "income" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <DateInput
              label={t("from")}
              value={incomeFrom}
              onChange={setIncomeFrom}
            />
            <DateInput
              label={t("to")}
              value={incomeTo}
              onChange={setIncomeTo}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
                {t("groupBy")}
              </span>
              <select
                value={incomeGroupBy}
                onChange={(e) => setIncomeGroupBy(e.target.value as GroupBy)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {GROUP_BYS.map((g) => (
                  <option key={g} value={g}>
                    {t(
                      `groupBy${g.charAt(0).toUpperCase()}${g.slice(1)}` as Parameters<typeof t>[0],
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {incomeQuery.isLoading ? (
            <div className="h-56 bg-muted rounded-xl animate-pulse" />
          ) : incomeGroups.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-card rounded-xl border border-border">
              <FileBarChart2 size={32} className="mx-auto mb-2 text-muted-foreground/50" />
              {t("noData")}
            </div>
          ) : (
            <ChartCard title={t("income.chartTitle")}>
              <div style={{ height: 240 }}>
                <ResponsiveBar
                  data={incomeGroups}
                  keys={["total"]}
                  indexBy="displayPeriod"
                  margin={{ top: 10, right: 10, bottom: 36, left: 80 }}
                  padding={0.4}
                  borderRadius={4}
                  colors={() => chartColors[3]}
                  theme={NIVO_THEME}
                  axisBottom={{ tickSize: 0, tickPadding: 5 }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 5,
                    format: (v) => formatCurrency(Number(v)),
                  }}
                  enableLabel={false}
                  tooltip={({ indexValue, value }) => (
                    <div style={tooltipStyle}>
                      {indexValue}: <strong>{formatCurrency(value)}</strong>
                    </div>
                  )}
                />
              </div>
            </ChartCard>
          )}

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <p className="text-sm font-medium text-foreground">
                {t("income.tableTitle")}
              </p>
            </div>
            {incomeQuery.isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : incomeTickets.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t("income.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/60">
                      <th className="px-5 py-3 text-left font-medium">
                        {t("income.colFolio")}
                      </th>
                      <th className="px-5 py-3 text-left font-medium">
                        {t("income.colWorkOrder")}
                      </th>
                      <th className="px-5 py-3 text-left font-medium">
                        {t("income.colEmployee")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("income.colTotal")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("income.colDate")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {incomeTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {ticket.folio}
                        </td>
                        <td className="px-5 py-3 text-foreground">
                          {ticket.work_order?.title ?? `#${ticket.id}`}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {ticket.employee?.name ?? t("income.unassigned")}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums">
                          {formatCurrency(ticket.total)}
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                          {ticket.paid_at
                            ? format(new Date(ticket.paid_at), "dd MMM yyyy", {
                                locale: dateLocale,
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GASTOS ── */}
      {tab === "expenses" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <DateInput
              label={t("from")}
              value={expensesFrom}
              onChange={setExpensesFrom}
            />
            <DateInput
              label={t("to")}
              value={expensesTo}
              onChange={setExpensesTo}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">
                {t("groupBy")}
              </span>
              <select
                value={expensesGroupBy}
                onChange={(e) => setExpensesGroupBy(e.target.value as GroupBy)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {GROUP_BYS.map((g) => (
                  <option key={g} value={g}>
                    {t(
                      `groupBy${g.charAt(0).toUpperCase()}${g.slice(1)}` as Parameters<typeof t>[0],
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {expensesQuery.isLoading ? (
            <div className="h-56 bg-muted rounded-xl animate-pulse" />
          ) : expenseGroups.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground bg-card rounded-xl border border-border">
              <FileBarChart2 size={32} className="mx-auto mb-2 text-muted-foreground/50" />
              {t("noData")}
            </div>
          ) : (
            <ChartCard title={t("expenses.chartTitle")}>
              <div style={{ height: 240 }}>
                <ResponsiveBar
                  data={expenseGroups}
                  keys={["payroll", "inventory"]}
                  indexBy="displayPeriod"
                  groupMode="stacked"
                  margin={{ top: 10, right: 10, bottom: 60, left: 80 }}
                  padding={0.4}
                  borderRadius={4}
                  colors={({ id }) => id === "payroll" ? chartColors[2] : chartColors[5]}
                  theme={NIVO_THEME}
                  axisBottom={{ tickSize: 0, tickPadding: 5 }}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 5,
                    format: (v) => formatCurrency(Number(v)),
                  }}
                  enableLabel={false}
                  legendLabel={(datum) =>
                    datum.id === "payroll" ? t("expenses.payroll") : t("expenses.inventory")
                  }
                  legends={[{
                    dataFrom: "keys",
                    anchor: "bottom",
                    direction: "row",
                    itemWidth: 110,
                    itemHeight: 16,
                    itemsSpacing: 8,
                    symbolSize: 8,
                    symbolShape: "circle",
                    itemTextColor: "var(--muted-foreground)",
                    translateY: 50,
                  }]}
                  tooltip={({ id, indexValue, value }) => (
                    <div style={tooltipStyle}>
                      {id === "payroll" ? t("expenses.payroll") : t("expenses.inventory")} ({indexValue}):{" "}
                      <strong>{formatCurrency(value)}</strong>
                    </div>
                  )}
                />
              </div>
            </ChartCard>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60">
                <p className="text-sm font-medium text-foreground">
                  {t("expenses.payrollTitle")}
                </p>
              </div>
              {expensesQuery.isLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-9 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : expensePayrollList.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("expenses.emptyPayroll")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border/60">
                        <th className="px-5 py-3 text-left font-medium">
                          {t("expenses.colEmployee")}
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          {t("expenses.colSalary")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {expensePayrollList.map((emp) => (
                        <tr
                          key={emp.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-5 py-3 text-foreground">
                            {emp.name}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums">
                            {formatCurrency(emp.salary)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-muted/50">
                        <td className="px-5 py-3 text-sm font-semibold text-foreground">
                          Total
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                          {formatCurrency(
                            expensePayrollList.reduce(
                              (s, e) => s + e.salary,
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60">
                <p className="text-sm font-medium text-foreground">
                  {t("expenses.inventoryTitle")}
                </p>
              </div>
              {expensesQuery.isLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-9 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : inventoryMovements.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("expenses.emptyInventory")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border/60">
                        <th className="px-5 py-3 text-left font-medium">
                          {t("expenses.colProduct")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("expenses.colQty")}
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          {t("expenses.colUnitCost")}
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          {t("expenses.colTotalCost")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {inventoryMovements.map((mv) => (
                        <tr
                          key={mv.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-5 py-3">
                            <p className="text-foreground">{mv.product.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {mv.product.sku}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                            {mv.qty}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                            {formatCurrency(mv.unit_cost)}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums">
                            {formatCurrency(mv.total_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── NÓMINA ── */}
      {tab === "payroll" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <DateInput
              label={t("from")}
              value={payrollFrom}
              onChange={setPayrollFrom}
            />
            <DateInput
              label={t("to")}
              value={payrollTo}
              onChange={setPayrollTo}
            />
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60">
              <p className="text-sm font-medium text-foreground">
                {t("payroll.title")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("payroll.subtitle")}
              </p>
            </div>
            {payrollQuery.isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : payrollEmployees.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <FileBarChart2
                  size={32}
                  className="mx-auto mb-2 text-muted-foreground/50"
                />
                {t("payroll.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/60">
                      <th className="px-5 py-3 text-left font-medium">
                        {t("payroll.colName")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("payroll.colSalary")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("payroll.colDays")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("payroll.colHours")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("payroll.colNormal")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("payroll.colLate")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("payroll.colAbsent")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payrollEmployees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-foreground">
                          {emp.name}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-foreground">
                          {formatCurrency(emp.salary)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-foreground">
                          {emp.days_present}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-foreground">
                          {emp.hours_worked.toFixed(1)}{" "}
                          <span className="text-muted-foreground text-xs">
                            {t("payroll.hoursUnit")}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-estado-completada-foreground font-medium tabular-nums">
                            {emp.attendance.normal}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-estado-pendiente-foreground font-medium tabular-nums">
                            {emp.attendance.late}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-destructive font-medium tabular-nums">
                            {emp.attendance.absent}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/50">
                      <td className="px-5 py-3 font-semibold text-foreground">
                        Total
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                        {formatCurrency(
                          payrollEmployees.reduce((s, e) => s + e.salary, 0),
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                        {payrollEmployees.reduce(
                          (s, e) => s + e.days_present,
                          0,
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                        {payrollEmployees
                          .reduce((s, e) => s + e.hours_worked, 0)
                          .toFixed(1)}{" "}
                        <span className="text-muted-foreground text-xs font-normal">
                          {t("payroll.hoursUnit")}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-estado-completada-foreground tabular-nums">
                        {payrollEmployees.reduce(
                          (s, e) => s + e.attendance.normal,
                          0,
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-estado-pendiente-foreground tabular-nums">
                        {payrollEmployees.reduce(
                          (s, e) => s + e.attendance.late,
                          0,
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-destructive tabular-nums">
                        {payrollEmployees.reduce(
                          (s, e) => s + e.attendance.absent,
                          0,
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
