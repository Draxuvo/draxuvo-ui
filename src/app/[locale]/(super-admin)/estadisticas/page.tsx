// src/app/[locale]/(super-admin)/estadisticas/page.tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { companiesService } from "@/services/companies";
import { getDashboardStatsByCompany } from "@/services/analytics";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import {
  Users,
  Package,
  ClipboardList,
  Receipt,
  UserCheck,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChartColors, type ChartColor } from "@/components/dashboard/chart-legend-links";
import type { Company } from "@/types";

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

const PRIORITY_COLORS: Record<string, ChartColor> = {
  low: 3,
  medium: 2,
  high: 4,
  urgent: 1,
};

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
      <div className="h-7 w-16 bg-muted rounded mb-1" />
      <div className="h-3 w-24 bg-muted rounded" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-medium text-foreground mb-4">{children}</h2>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EstadisticasPage() {
  const t = useTranslations("analyticsBoard");
  const chartColors = useChartColors();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const { data: companiesData } = useQuery({
    queryKey: ["companies-all"],
    queryFn: () => companiesService.list(1, "", 100),
  });

  const companies = companiesData?.results ?? [];

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-stats-sa", selectedCompany?.id],
    queryFn: () => getDashboardStatsByCompany(selectedCompany!.id),
    enabled: !!selectedCompany,
    staleTime: 2 * 60 * 1000,
  });

  const workOrderStatusData = data
    ? Object.entries(data.work_orders.by_status).map(([key, val]) => ({
        name: t(`workOrderStatuses.${key}`),
        value: val,
        fill: chartColors[STATUS_COLORS[key] ?? 5],
      }))
    : [];

  const workOrderPriorityData = data
    ? Object.entries(data.work_orders.by_priority).map(([key, val]) => ({
        name: t(`priorities.${key}`),
        value: val,
        fill: chartColors[PRIORITY_COLORS[key] ?? 5],
      }))
    : [];

  const ticketData = data
    ? [
        { name: t("ticketPaid"), value: data.tickets.paid, fill: chartColors[3] },
        { name: t("ticketPending"), value: data.tickets.pending, fill: chartColors[4] },
      ]
    : [];

  const attendanceTodayData = data
    ? [
        { name: t("attendanceNormal"), value: data.attendance.today.normal, fill: chartColors[3] },
        { name: t("attendanceLate"), value: data.attendance.today.late, fill: chartColors[4] },
        { name: t("attendanceAbsent"), value: data.attendance.today.absent, fill: chartColors[1] },
      ]
    : [];

  return (
    <div>
      {/* Header + company selector */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitleAdmin")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Building2
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <select
              value={selectedCompany?.id ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                const company = companies.find((c) => c.id === id) ?? null;
                setSelectedCompany(company);
              }}
              className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t("selectCompany")}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {selectedCompany && (
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:pointer-events-none"
            >
              <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!selectedCompany && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 size={40} className="text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground">{t("selectCompanyHint")}</p>
        </div>
      )}

      {selectedCompany && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard
                  label={t("totalEmployees")}
                  value={data?.employees.total ?? 0}
                  sub={t("employeesSub", {
                    active: data?.employees.active ?? 0,
                    inactive: data?.employees.inactive ?? 0,
                  })}
                  icon={Users}
                  iconColor="text-estado-progreso-foreground"
                  iconBg="bg-estado-progreso"
                />
                <StatCard
                  label={t("totalWorkOrders")}
                  value={data?.work_orders.total ?? 0}
                  sub={t("workOrdersSub", {
                    completed: data?.work_orders.by_status.completed ?? 0,
                  })}
                  icon={ClipboardList}
                  iconColor="text-estado-revision-foreground"
                  iconBg="bg-estado-revision"
                />
                <StatCard
                  label={t("totalTickets")}
                  value={data?.tickets.total ?? 0}
                  sub={t("ticketsPending", { count: data?.tickets.pending ?? 0 })}
                  icon={Receipt}
                  iconColor="text-estado-pendiente-foreground"
                  iconBg="bg-estado-pendiente"
                />
                <StatCard
                  label={t("totalRevenue")}
                  value={formatCurrency(data?.tickets.total_revenue ?? 0)}
                  sub={t("pendingRevenue", {
                    amount: formatCurrency(data?.tickets.pending_revenue ?? 0),
                  })}
                  icon={DollarSign}
                  iconColor="text-estado-completada-foreground"
                  iconBg="bg-estado-completada"
                />
                <StatCard
                  label={t("totalInventory")}
                  value={data?.inventory.total ?? 0}
                  sub={t("inventorySub", { available: data?.inventory.available ?? 0 })}
                  icon={Package}
                  iconColor="text-estado-completada-foreground"
                  iconBg="bg-estado-completada"
                />
                <StatCard
                  label={t("lowStock")}
                  value={data?.inventory.low_stock ?? 0}
                  sub={t("outOfStock", { count: data?.inventory.out_of_stock ?? 0 })}
                  icon={AlertTriangle}
                  iconColor="text-estado-pendiente-foreground"
                  iconBg="bg-estado-pendiente"
                />
                <StatCard
                  label={t("attendanceToday")}
                  value={data?.attendance.today.total ?? 0}
                  sub={t("attendanceMonth", { count: data?.attendance.this_month ?? 0 })}
                  icon={UserCheck}
                  iconColor="text-estado-revision-foreground"
                  iconBg="bg-estado-revision"
                />
                <StatCard
                  label={t("totalUsers")}
                  value={data?.users.total ?? 0}
                  icon={TrendingUp}
                  iconColor="text-estado-revision-foreground"
                  iconBg="bg-estado-revision"
                />
              </>
            )}
          </div>

          <SectionTitle>{t("sectionOrders")}</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            <ChartCard title={t("chartOrdersByStatus")}>
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

            <ChartCard title={t("chartOrdersByPriority")}>
              <div style={{ height: 220 }}>
                <ResponsivePie<{ id: string; value: number; color: string }>
                  data={workOrderPriorityData.map((d) => ({
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
                      {datum.label}: <strong>{datum.value}</strong>
                    </div>
                  )}
                />
              </div>
            </ChartCard>
          </div>

          <SectionTitle>{t("sectionFinance")}</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            <ChartCard title={t("chartTickets")}>
              <div style={{ height: 220 }}>
                <ResponsivePie<{ id: string; value: number; color: string }>
                  data={ticketData.map((d) => ({
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
                      {datum.label}: <strong>{datum.value}</strong>
                    </div>
                  )}
                />
              </div>
            </ChartCard>

            <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-4 justify-center">
              <p className="text-sm font-medium text-foreground">{t("revenueBreakdown")}</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-estado-completada-border shrink-0" />
                    <span className="text-sm text-muted-foreground">{t("collectedRevenue")}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency((data?.tickets.total_revenue ?? 0) - (data?.tickets.pending_revenue ?? 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-estado-pendiente-border shrink-0" />
                    <span className="text-sm text-muted-foreground">{t("pendingRevenueLabel")}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(data?.tickets.pending_revenue ?? 0)}
                  </span>
                </div>
                <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{t("totalRevenue")}</span>
                  <span className="text-base font-semibold text-foreground">
                    {formatCurrency(data?.tickets.total_revenue ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <SectionTitle>{t("sectionAttendance")}</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title={t("chartAttendanceToday")}>
              <div style={{ height: 220 }}>
                <ResponsiveBar<{ name: string; value: number; fill: string }>
                  data={attendanceTodayData}
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

            <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-4 justify-center">
              <p className="text-sm font-medium text-foreground">{t("inventoryBreakdown")}</p>
              <div className="space-y-3">
                {[
                  { label: t("inventoryAvailable"), value: data?.inventory.available ?? 0, color: "bg-estado-completada-border" },
                  { label: t("inventoryUnavailable"), value: data?.inventory.unavailable ?? 0, color: "bg-muted-foreground/30" },
                  { label: t("inventoryLowStock"), value: data?.inventory.low_stock ?? 0, color: "bg-estado-pendiente-border" },
                  { label: t("inventoryOutOfStock"), value: data?.inventory.out_of_stock ?? 0, color: "bg-destructive" },
                ].map(({ label, value, color }) => {
                  const total = data?.inventory.total || 1;
                  const pct = Math.round((value / total) * 100);
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                          <span className="text-sm text-muted-foreground">{label}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {value} <span className="text-muted-foreground font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
