// src/app/[locale]/(dashboard)/dashboard/page.tsx
// Dashboard navegable (US1, contracts/ui-routes.md "Dashboard: tarjeta o gráfica a destino").
// Cada tarjeta, barra, rebanada y concepto de leyenda abre su lista filtrada. Una pieza se
// muestra solo si su módulo está en `active_modules` y el rol puede abrir el destino.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  ClipboardList,
  FileBarChart2,
  Package,
  Receipt,
  RefreshCw,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useAppRouter } from "@/hooks/use-router";
import { getDashboardStats } from "@/services/analytics";
import { StatLinkCard, StatLinkCardSkeleton, type StatLinkCardProps } from "@/components/dashboard/stat-link-card";
import {
  ChartLegendLinks,
  useChartColors,
  type ChartColor,
  type LegendItem,
} from "@/components/dashboard/chart-legend-links";
import {
  ATTENDANCE_TYPES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type ModuleKey,
  type User,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/types";

type Role = User["role"];
const ANALYTICS_ROLES: Role[] = ["owner", "admin", "manager"];
const REPORTS_ROLES: Role[] = ["owner", "admin"];
const BILLING_ROLES: Role[] = ["owner", "admin"];

const STATUS_COLOR: Record<WorkOrderStatus, ChartColor> = {
  open: 2,
  in_progress: 1,
  done: 5,
  paid: 3,
  cancelled: 4,
};
const PRIORITY_COLOR: Record<WorkOrderPriority, ChartColor> = {
  low: 5,
  medium: 4,
  high: 2,
  urgent: 1,
};
const ATTENDANCE_COLOR = { normal: 3, late: 4, absent: 1 } as const satisfies Record<string, ChartColor>;
const ATTENDANCE_LABEL = { normal: "attendanceNormal", late: "attendanceLate", absent: "attendanceAbsent" } as const;

/** Hoy en America/Mexico_City como `YYYY-MM-DD`, la misma zona que usa la API. */
function todayInMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Una pieza del gráfico: conserva la clave cruda y la ruta (sin locale) a la que navega. */
interface ChartPart extends LegendItem {
  path?: string;
}

function ChartCard({
  title,
  legendLabel,
  emptyText,
  parts,
  kind,
}: {
  title: string;
  legendLabel: string;
  emptyText: string;
  parts: ChartPart[];
  kind: "bar" | "pie";
}) {
  const router = useAppRouter();
  const colors = useChartColors();
  const total = parts.reduce((sum, p) => sum + p.count, 0);
  const data = parts.map((p) => ({
    id: p.key,
    key: p.key,
    label: p.label,
    value: p.count,
    color: colors[p.color],
    path: p.path ?? "",
  }));
  const go = (path: string) => path && router.push(path);
  const tooltip = (label: string | number, value: number) => (
    <div className="rounded-etiqueta bg-card px-2.5 py-1.5 text-xs text-foreground shadow-etiqueta">
      {label}: <strong className="tabular-nums">{value}</strong>
    </div>
  );

  return (
    <section className="flex flex-col rounded-etiqueta bg-card p-4 text-card-foreground shadow-etiqueta">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 h-48">
        {total === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : kind === "bar" ? (
          <div className="h-full [&_svg_rect]:cursor-pointer">
            <ResponsiveBar
              data={data}
              keys={["value"]}
              indexBy="label"
              margin={{ top: 8, right: 8, bottom: 28, left: 32 }}
              padding={0.35}
              borderRadius={3}
              colors={(bar) => bar.data.color}
              borderWidth={1}
              borderColor={{ from: "color", modifiers: [["darker", 0.6]] }}
              theme={{
                text: { fill: colors[5], fontSize: 11 },
                axis: { ticks: { line: { strokeWidth: 0 } }, domain: { line: { strokeWidth: 0 } } },
              }}
              enableGridY={false}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 6,
                tickValues: 4,
                format: (v) => (Number.isInteger(Number(v)) ? String(v) : ""),
              }}
              enableLabel={false}
              animate={false}
              role="img"
              ariaLabel={title}
              onClick={(bar) => go(bar.data.path)}
              tooltip={({ indexValue, value }) => tooltip(indexValue, value)}
            />
          </div>
        ) : (
          <div className="h-full [&_svg_path]:cursor-pointer">
            <ResponsivePie
              data={data}
              innerRadius={0.62}
              padAngle={2}
              cornerRadius={2}
              colors={(d) => d.data.color}
              borderWidth={1}
              borderColor={{ from: "color", modifiers: [["darker", 0.6]] }}
              enableArcLinkLabels={false}
              enableArcLabels={false}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              animate={false}
              role="img"
              onClick={(d) => go(d.data.path)}
              tooltip={({ datum }) => tooltip(datum.label, datum.value)}
            />
          </div>
        )}
      </div>
      <ChartLegendLinks className="mt-3" label={legendLabel} items={parts} />
    </section>
  );
}

function SummaryCard({ title, legendLabel, items }: { title: string; legendLabel: string; items: LegendItem[] }) {
  return (
    <section className="flex flex-col rounded-etiqueta bg-card p-4 text-card-foreground shadow-etiqueta">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ChartLegendLinks className="mt-3" label={legendLabel} items={items} />
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-display text-xl font-semibold leading-tight text-foreground">{children}</h2>;
}

export default function DashboardPage() {
  const t = useTranslations("analyticsBoard");
  const ti = useTranslations("inventory");
  const tc = useTranslations("common");
  const tw = useTranslations("workOrders");
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const [today] = useState(todayInMexico);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", selectedCompanyId],
    queryFn: getDashboardStats,
    staleTime: 2 * 60 * 1000,
  });

  const role = useAuthStore((s) => s.role);
  const can = (module: ModuleKey, roles: Role[] = ANALYTICS_ROLES) =>
    !!data && !!role && data.active_modules.includes(module) && roles.includes(role);
  const href = (path: string) => `/${locale}${path}`;
  const attendancePath = `/personal?tab=asistencia&from=${today}&to=${today}`;

  const cards: (StatLinkCardProps & { id: string })[] = [];
  const legend = (chart: string) => t("legendLabel", { chart });

  if (data) {
    const { employees, work_orders, tickets, inventory, attendance } = data;
    if (can("employees")) {
      cards.push({
        id: "employees",
        label: t("totalEmployees"),
        value: employees.total,
        href: href("/empleados"),
        ariaLabel: t("aria.employees", { count: employees.total }),
        icon: Users,
        subsets: [
          {
            label: t("subset.active", { count: employees.active }),
            href: href("/empleados?status=active"),
            ariaLabel: t("aria.employeesActive", { count: employees.active }),
          },
          {
            label: t("subset.inactive", { count: employees.inactive }),
            href: href("/empleados?status=inactive"),
            ariaLabel: t("aria.employeesInactive", { count: employees.inactive }),
          },
        ],
      });
    }
    if (can("work_orders")) {
      const open = work_orders.by_status.open ?? 0;
      const toCharge = work_orders.to_charge ?? 0;
      cards.push({
        id: "work_orders",
        label: t("totalWorkOrders"),
        value: work_orders.total,
        href: href("/ordenes"),
        ariaLabel: t("aria.workOrders", { count: work_orders.total }),
        icon: ClipboardList,
        subsets: [
          {
            label: t("subset.open", { count: open }),
            href: href("/ordenes?status=open"),
            ariaLabel: t("aria.workOrdersOpen", { count: open }),
            highlight: open > 0,
          },
        ],
      });
      // Por cobrar: órdenes terminadas (done) que aún no se cobran; abre el grupo en /ordenes.
      cards.push({
        id: "to_charge",
        label: t("toCharge"),
        value: formatCurrency(work_orders.to_charge_total ?? 0),
        href: href("/ordenes?status=done"),
        ariaLabel: t("aria.toCharge", { count: toCharge, amount: formatCurrency(work_orders.to_charge_total ?? 0) }),
        icon: Banknote,
        subsets: [
          {
            label: t("subset.toChargeCount", { count: toCharge }),
            href: href("/ordenes?status=done"),
            ariaLabel: t("aria.toCharge", { count: toCharge, amount: formatCurrency(work_orders.to_charge_total ?? 0) }),
            highlight: toCharge > 0,
          },
        ],
      });
    }
    if (can("tickets")) {
      cards.push({
        id: "tickets",
        label: t("totalTickets"),
        value: tickets.total,
        href: href("/tickets"),
        ariaLabel: t("aria.tickets", { count: tickets.total }),
        icon: Receipt,
        subsets: [
          {
            label: t("subset.paid", { count: tickets.paid }),
            href: href("/tickets?status=paid"),
            ariaLabel: t("aria.ticketsPaid", { count: tickets.paid }),
          },
          {
            label: t("subset.voided", { count: tickets.voided ?? 0 }),
            href: href("/tickets?status=voided"),
            ariaLabel: t("aria.ticketsVoided", { count: tickets.voided ?? 0 }),
          },
        ],
      });
      // `total_revenue` ya suma solo tickets pagados: es lo cobrado (data-model §2).
      cards.push({
        id: "revenue",
        label: t("collected"),
        value: formatCurrency(tickets.total_revenue),
        href: href("/tickets?status=paid"),
        ariaLabel: t("aria.revenue", { amount: formatCurrency(tickets.total_revenue) }),
        icon: Banknote,
      });
    }
    if (can("inventory")) {
      cards.push({
        id: "inventory",
        label: t("products"),
        value: inventory.total,
        href: href("/inventario"),
        ariaLabel: t("aria.products", { count: inventory.total }),
        icon: Package,
        subsets: [
          {
            label: t("subset.available", { count: inventory.available }),
            href: href("/inventario?available=true"),
            ariaLabel: t("aria.available", { count: inventory.available }),
          },
          // Productos y valor a costo por tipo (spec 016, FR-014); cada uno abre su pestaña en Inventario.
          ...(inventory.by_type ?? []).map((type) => {
            const label = type.value === null
              ? `${type.name}: ${ti("byTypeProducts", { count: type.products })}`
              : `${type.name}: ${ti("byTypeProducts", { count: type.products })} · ${ti("byTypeValue", { value: formatCurrency(type.value) })}`;
            return { label, href: href(`/inventario?product_type_id=${type.id}`), ariaLabel: label };
          }),
        ],
      });
      cards.push({
        id: "low_stock",
        label: t("lowStock"),
        value: inventory.low_stock,
        href: href("/inventario?low_stock=true"),
        ariaLabel: t("aria.lowStock", { count: inventory.low_stock }),
        icon: AlertTriangle,
        subsets: [
          {
            label: t("subset.outOfStock", { count: inventory.out_of_stock }),
            href: href("/inventario?out_of_stock=true"),
            ariaLabel: t("aria.outOfStock", { count: inventory.out_of_stock }),
            highlight: inventory.out_of_stock > 0,
          },
        ],
      });
    }
    if (can("attendance")) {
      cards.push({
        id: "attendance_today",
        label: t("attendanceToday"),
        value: attendance.today.total,
        href: href(attendancePath),
        ariaLabel: t("aria.attendanceToday", { count: attendance.today.total }),
        icon: CalendarCheck,
        subsets: [{ label: t("subset.thisMonth", { count: attendance.this_month }) }],
      });
    }
    if (can("reports", REPORTS_ROLES)) {
      cards.push({
        id: "reports",
        label: t("reports"),
        description: t("reportsSub"),
        href: href("/reportes"),
        ariaLabel: t("aria.reports"),
        icon: FileBarChart2,
      });
    }
  }

  // Partes de gráficas y leyendas (data-model §2), con la clave cruda de la API.
  const statusParts: ChartPart[] = data
    ? WORK_ORDER_STATUSES.map((s) => {
        const count = data.work_orders.by_status[s] ?? 0;
        const label = tw(`statuses.${s}`);
        const path = `/ordenes?status=${s}`;
        return {
          key: s,
          label,
          count,
          color: STATUS_COLOR[s],
          path,
          href: href(path),
          ariaLabel: t("aria.workOrdersStatus", { count, status: label }),
        };
      })
    : [];
  const priorityParts: ChartPart[] = data
    ? WORK_ORDER_PRIORITIES.map((p) => {
        const count = data.work_orders.by_priority[p] ?? 0;
        const label = t(`priorities.${p}`);
        const path = `/ordenes?priority=${p}`;
        return {
          key: p,
          label,
          count,
          color: PRIORITY_COLOR[p],
          path,
          href: href(path),
          ariaLabel: t("aria.workOrdersPriority", { count, priority: label }),
        };
      })
    : [];
  const ticketParts: ChartPart[] = data
    ? [
        {
          key: "paid",
          label: t("ticketPaid"),
          count: data.tickets.paid,
          color: 3,
          path: "/tickets?status=paid",
          href: href("/tickets?status=paid"),
          ariaLabel: t("aria.ticketsPaid", { count: data.tickets.paid }),
        },
        {
          key: "voided",
          label: t("ticketVoided"),
          count: data.tickets.voided ?? 0,
          color: 1,
          path: "/tickets?status=voided",
          href: href("/tickets?status=voided"),
          ariaLabel: t("aria.ticketsVoided", { count: data.tickets.voided ?? 0 }),
        },
      ]
    : [];
  const revenueItems: LegendItem[] = data
    ? [
        {
          key: "collected",
          label: t("collectedRevenue"),
          count: data.tickets.total_revenue,
          display: formatCurrency(data.tickets.total_revenue),
          color: 3,
          href: href("/tickets?status=paid"),
          ariaLabel: t("aria.revenue", { amount: formatCurrency(data.tickets.total_revenue) }),
        },
        {
          key: "to_charge",
          label: t("toChargeLabel"),
          count: data.work_orders.to_charge_total ?? 0,
          display: formatCurrency(data.work_orders.to_charge_total ?? 0),
          color: 4,
          href: href("/ordenes?status=done"),
          ariaLabel: t("aria.toCharge", {
            count: data.work_orders.to_charge ?? 0,
            amount: formatCurrency(data.work_orders.to_charge_total ?? 0),
          }),
        },
      ]
    : [];
  const attendanceParts: ChartPart[] = data
    ? ATTENDANCE_TYPES.map((type) => {
        const count = data.attendance.today[type];
        const label = t(ATTENDANCE_LABEL[type]);
        const path = `${attendancePath}&type=${type}`;
        return {
          key: type,
          label,
          count,
          color: ATTENDANCE_COLOR[type],
          path,
          href: href(path),
          ariaLabel: t("aria.attendanceType", { count, type: label }),
        };
      })
    : [];
  // "No disponibles" sin enlace: la API solo filtra available=true.
  const inventoryItems: LegendItem[] = data
    ? [
        {
          key: "available",
          label: t("inventoryAvailable"),
          count: data.inventory.available,
          color: 3,
          href: href("/inventario?available=true"),
          ariaLabel: t("aria.available", { count: data.inventory.available }),
        },
        { key: "unavailable", label: t("inventoryUnavailable"), count: data.inventory.unavailable, color: 5 },
        {
          key: "low_stock",
          label: t("inventoryLowStock"),
          count: data.inventory.low_stock,
          color: 4,
          href: href("/inventario?low_stock=true"),
          ariaLabel: t("aria.lowStock", { count: data.inventory.low_stock }),
        },
        {
          key: "out_of_stock",
          label: t("inventoryOutOfStock"),
          count: data.inventory.out_of_stock,
          color: 1,
          href: href("/inventario?out_of_stock=true"),
          ariaLabel: t("aria.outOfStock", { count: data.inventory.out_of_stock }),
        },
      ]
    : [];

  const showOrders = can("work_orders");
  const showTickets = can("tickets");
  const showAttendance = can("attendance");
  const showInventory = can("inventory");
  const anyChart = showOrders || showTickets || showAttendance || showInventory;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle", { name: user?.first_name ?? "" })}</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label={tc("refresh")}
          className="rounded-etiqueta p-2 text-muted-foreground transition-colors duration-[120ms] hover:bg-card hover:text-foreground foco-etiqueta disabled:pointer-events-none"
        >
          <RefreshCw size={18} strokeWidth={1.75} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatLinkCardSkeleton key={i} />
          ))}
        </div>
      ) : isError || !data ? (
        <div role="alert" className="rounded-etiqueta bg-card p-6 text-sm shadow-etiqueta">
          <p className="font-medium text-foreground">{t("empty.loadError")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-etiqueta px-1 font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground foco-etiqueta"
          >
            {tc("retry")}
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-etiqueta bg-card p-6 shadow-etiqueta">
          <p className="font-medium text-foreground">{t("empty.noModules")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("empty.noModulesHint")}</p>
          {role && BILLING_ROLES.includes(role) && (
            <Link
              href={href("/suscripcion")}
              className="mt-4 inline-flex h-9 items-center rounded-etiqueta bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-[120ms] hover:bg-primary-hover foco-etiqueta"
            >
              {t("empty.viewPlans")}
            </Link>
          )}
        </div>
      ) : (
        <>
          <section aria-label={t("kpis")}>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map(({ id, ...card }) => (
                <li key={id} className="flex">
                  <StatLinkCard {...card} className="w-full" />
                </li>
              ))}
            </ul>
          </section>

          {anyChart && <p className="text-sm text-muted-foreground">{t("legendHint")}</p>}

          {showOrders && (
            <section>
              <SectionTitle>{t("sectionOrders")}</SectionTitle>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard
                  kind="bar"
                  title={t("chartOrdersByStatus")}
                  legendLabel={legend(t("chartOrdersByStatus"))}
                  emptyText={t("empty.workOrders")}
                  parts={statusParts}
                />
                <ChartCard
                  kind="pie"
                  title={t("chartOrdersByPriority")}
                  legendLabel={legend(t("chartOrdersByPriority"))}
                  emptyText={t("empty.workOrders")}
                  parts={priorityParts}
                />
              </div>
            </section>
          )}

          {showTickets && (
            <section>
              <SectionTitle>{t("sectionFinance")}</SectionTitle>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard
                  kind="pie"
                  title={t("chartTickets")}
                  legendLabel={legend(t("chartTickets"))}
                  emptyText={t("empty.tickets")}
                  parts={ticketParts}
                />
                <SummaryCard
                  title={t("revenueBreakdown")}
                  legendLabel={legend(t("revenueBreakdown"))}
                  items={revenueItems}
                />
              </div>
            </section>
          )}

          {(showAttendance || showInventory) && (
            <section>
              <SectionTitle>{t("sectionAttendance")}</SectionTitle>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {showAttendance && (
                  <ChartCard
                    kind="bar"
                    title={t("chartAttendanceToday")}
                    legendLabel={legend(t("chartAttendanceToday"))}
                    emptyText={t("empty.attendanceToday")}
                    parts={attendanceParts}
                  />
                )}
                {showInventory && (
                  <SummaryCard
                    title={t("chartInventory")}
                    legendLabel={legend(t("chartInventory"))}
                    items={inventoryItems}
                  />
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
