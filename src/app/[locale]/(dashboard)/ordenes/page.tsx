// src/app/[locale]/(dashboard)/ordenes/page.tsx
// Lista del jefe: grupos por estado con su conteo (Abiertas, En curso, Por cobrar, Cobradas hoy, Sin
// asignar). Al elegir un estado se ve la lista completa de ese estado, paginada.
"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ClipboardList, Plus, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/work-orders/priority-badge";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { ProgressBar } from "@/components/work-orders/progress-bar";
import { OrderForm } from "@/components/work-orders/order-form";
import { useScreenMode } from "@/components/take-order/use-screen-mode";
import { ClosedChecks, OpenChecks, useClosedChecks, useOpenChecks } from "@/components/take-order/open-checks";
import { matchesCheckFilter, type CheckFilter } from "@/components/take-order/lib";
import { useAppRouter } from "@/hooks/use-router";
import { OrderModeDialog } from "@/components/work-orders/order-mode-dialog";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { FilterNotice } from "@/components/filters/filter-notice";
import { SearchInput } from "@/components/filters/search-input";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useWorkOrders, useWorkOrderSummary } from "@/hooks/use-work-orders";
import { employeesService } from "@/services/employees";
import { getDashboardStats } from "@/services/analytics";
import { useAuthStore } from "@/store/auth";
import {
  WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES,
  type WorkOrder, type WorkOrderFilters, type WorkOrderPriority, type WorkOrderStatus,
} from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const GROUP_SIZE = 5;
const DEFAULTS = { status: "", priority: "", employee_id: "", search: "" };
const ALLOWED = { status: WORK_ORDER_STATUSES, priority: WORK_ORDER_PRIORITIES };
const ID_PATTERN = /^\d+$/;

const CHIP =
  "inline-flex h-9 items-center rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta foco-etiqueta";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF = "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground";
const SELECT =
  "h-10 w-full rounded-etiqueta border border-input bg-card px-2.5 text-sm text-foreground transition-colors duration-[120ms] hover:border-foreground/40 foco-etiqueta sm:w-auto";

export default function OrdenesPage() {
  return (
    <Suspense>
      <OrdenesContent />
    </Suspense>
  );
}

function OrderRow({ order, showPriority }: { order: WorkOrder; showPriority: boolean }) {
  const t = useTranslations("workOrders");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  return (
    <li>
      <Link
        href={`/${locale}/ordenes/${order.id}`}
        className="flex min-h-16 flex-col gap-2 rounded-etiqueta border border-transparent bg-card p-4 shadow-etiqueta transition-colors duration-[120ms] ease-etiqueta hover:border-foreground/40 foco-etiqueta"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} />
              {showPriority && <PriorityBadge priority={order.priority} />}
            </div>
            <p className="truncate font-medium text-foreground">{order.title}</p>
            {order.customer_name && <p className="truncate text-sm text-muted-foreground">{order.customer_name}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg font-semibold tabular-nums">{money.format(Number(order.total ?? 0))}</p>
            <p className="text-xs text-muted-foreground">{order.employee?.name ?? t("unassigned")}</p>
            {order.due_date && showPriority && (
              <p className="text-xs text-muted-foreground tabular-nums">{format(new Date(order.due_date), "dd MMM")}</p>
            )}
          </div>
        </div>
        {order.steps_count > 0 && <ProgressBar steps_done={order.steps_done} steps_count={order.steps_count} />}
      </Link>
    </li>
  );
}

function Group({
  title, count, extra, filters, showPriority, enabled, hideEmpty = false,
}: {
  title: string; count: number | undefined; extra?: string; filters: WorkOrderFilters; showPriority: boolean; enabled: boolean;
  /** En un restaurante los grupos vacíos de órdenes de trabajo no estorban (spec 032). */
  hideEmpty?: boolean;
}) {
  const t = useTranslations("workOrders");
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useWorkOrders(filters, { page_size: expanded ? PAGE_SIZE : GROUP_SIZE }, { enabled });
  const orders = data?.results ?? [];
  const total = data?.info?.total ?? count ?? 0;
  if (hideEmpty && count === 0) return null;

  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">
          {title} <span className="text-muted-foreground tabular-nums">({count ?? total})</span>
        </h2>
        {extra && <p className="text-sm font-medium tabular-nums">{extra}</p>}
      </div>
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-etiqueta" />
      ) : orders.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{t("groups.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} showPriority={showPriority} />
          ))}
        </ul>
      )}
      {total > GROUP_SIZE && (
        <Button variant="ghost" className="h-10" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t("groups.showLess") : t("groups.showMore")}
        </Button>
      )}
    </section>
  );
}

function OrdenesContent() {
  const t = useTranslations("workOrders");
  const tq = useTranslations("cuentas");
  const tc = useTranslations("common");
  const tf = useTranslations("common.filters");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const role = useAuthStore((s) => s.role);
  const mode = useAuthStore((s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.order_mode ?? "service");
  const isOwner = role === "owner" || role === "super_admin";
  const today = format(new Date(), "yyyy-MM-dd");

  const { filters, page, setFilter, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, { allowed: ALLOWED });
  const employeeId = ID_PATTERN.test(filters.employee_id) ? filters.employee_id : "";

  const [formOpen, setFormOpen] = useState(false);
  const router = useAppRouter();
  // Con restaurante o en modo pedido, "nueva orden" abre la pantalla visual (spec 018).
  const { mode: screen } = useScreenMode();
  // Con mesas, todas las cuentas abiertas de la empresa se ven aquí (spec 020).
  const openChecks = useOpenChecks("all");
  const closedChecks = useClosedChecks("all");
  const restaurant = screen === "restaurant";
  const toPayChecks = openChecks.filter((check) => check.state === "to_pay");
  const openOnlyChecks = openChecks.filter((check) => check.state !== "to_pay");
  const newOrder = () => (screen !== "none" ? router.push("/pedido") : setFormOpen(true));
  const [modeOpen, setModeOpen] = useState(false);

  const gate = useModuleGate("work_orders");
  const { data: summary, error: summaryError, refetch, isFetching } = useWorkOrderSummary({ enabled: gate.enabled });

  const common: WorkOrderFilters = {
    priority: (filters.priority || undefined) as WorkOrderPriority | undefined,
    employee_id: employeeId ? Number(employeeId) : undefined,
    search: filters.search || undefined,
  };
  // Con un estado elegido (o una búsqueda) se ve la lista completa; si no, los grupos.
  const flat = !!filters.status || !!filters.search || !!filters.priority || !!employeeId;
  const { data, isLoading, error } = useWorkOrders(
    { ...common, status: (filters.status || undefined) as WorkOrderStatus | undefined },
    { page, page_size: PAGE_SIZE },
    { enabled: gate.enabled && flat },
  );

  const { data: stats } = useQuery({
    queryKey: ["dashboard", selectedCompanyId],
    queryFn: getDashboardStats,
    staleTime: 60 * 1000,
    enabled: gate.enabled,
  });
  const hasEmployees = !!stats?.active_modules.includes("employees");
  const { data: employeeOptions } = useQuery({
    queryKey: ["employees", "options"],
    queryFn: () => employeesService.list({ page: 1, page_size: 100 }),
    enabled: hasEmployees,
    staleTime: 5 * 60 * 1000,
  });

  if (gate.isLocked(error ?? summaryError)) return <ModuleLocked module="work_orders" />;

  const showPriority = mode === "service";
  const counts = summary?.counts;
  const employeeName = employeeOptions?.results.find((e) => String(e.id) === employeeId)?.name ?? `#${employeeId}`;
  // Los filtros también recortan las cuentas de mesa; un responsable sin usuario ligado no atiende ninguna (-1).
  const checkFilter: CheckFilter = {
    status: filters.status,
    userId: employeeId ? (employeeOptions?.results.find((e) => String(e.id) === employeeId)?.user_id ?? -1) : null,
    search: filters.search,
  };
  const shownToPay = toPayChecks.filter((check) => matchesCheckFilter(check, "to_pay", checkFilter));
  const shownOpen = openOnlyChecks.filter((check) => matchesCheckFilter(check, "open", checkFilter));
  const shownClosed = closedChecks.filter((check) => matchesCheckFilter(check, "paid", checkFilter));
  const shownChecks = shownToPay.length + shownOpen.length + shownClosed.length;
  const applied = [
    filters.status && `${t("status")}: ${t(`statuses.${filters.status as WorkOrderStatus}`)}`,
    filters.priority && `${t("priority")}: ${t(`priorities.${filters.priority as WorkOrderPriority}`)}`,
    employeeId && `${t("employee")}: ${employeeName}`,
    filters.search && `"${filters.search}"`,
  ].filter(Boolean);
  const statusChips = [{ value: "", label: t("all") }, ...WORK_ORDER_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))];
  const orders = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight font-semibold">{restaurant ? tq("title") : t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {flat && isFiltered
              ? tf("results", { count: (data?.info?.total ?? 0) + (restaurant ? shownChecks : 0) })
              : restaurant
                ? tq("subtitle", { open: openOnlyChecks.length, toPay: toPayChecks.length })
                : t("subtitle", { count: summaryTotal(counts) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" className="size-10" onClick={() => refetch()} disabled={isFetching} aria-label={tc("refresh")}>
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          {isOwner && (
            <Button variant="outline" className="h-10 gap-2" onClick={() => setModeOpen(true)}>
              <Settings2 size={15} aria-hidden="true" />
              {t("mode.open")}
            </Button>
          )}
          <Button className="h-10 gap-2" onClick={newOrder}>
            <Plus size={15} aria-hidden="true" />
            {restaurant ? tq("new") : t(`labels.${mode}.new`)}
          </Button>
        </div>
      </div>

      {restaurant ? (
        <>
          <OpenChecks checks={shownToPay} from="ordenes" title={tq("toPay")} id="checks-to-pay-title" />
          <OpenChecks checks={shownOpen} from="ordenes" title={tq("open")} id="checks-open-title" />
          <ClosedChecks checks={shownClosed} from="ordenes" title={tq("paidToday")} id="checks-paid-title" />
          {openChecks.length === 0 && closedChecks.length === 0 && !flat && <p className="text-sm text-muted-foreground">{tq("empty")}</p>}
        </>
      ) : (
        <OpenChecks checks={openChecks} from="ordenes" />
      )}

      <div role="group" aria-label={t("filters.status")} className="flex flex-wrap gap-2">
        {statusChips.map((s) => (
          <button
            key={s.value || "all"}
            type="button"
            aria-pressed={filters.status === s.value}
            onClick={() => setFilter("status", s.value || null)}
            className={cn(CHIP, filters.status === s.value ? CHIP_ON : CHIP_OFF)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={filters.search} onSearch={(value) => setFilter("search", value)} placeholder={t("searchPlaceholder")} />
        {showPriority && (
          <select aria-label={t("filters.priority")} className={SELECT} value={filters.priority} onChange={(e) => setFilter("priority", e.target.value || null)}>
            <option value="">{t("filters.allPriorities")}</option>
            {WORK_ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`priorities.${p}`)}
              </option>
            ))}
          </select>
        )}
        {(hasEmployees || employeeId) && (
          <select aria-label={t("filters.employee")} className={SELECT} value={employeeId} onChange={(e) => setFilter("employee_id", e.target.value || null)}>
            <option value="">{t("filters.allEmployees")}</option>
            {employeeId && !employeeOptions?.results.some((e) => String(e.id) === employeeId) && <option value={employeeId}>{employeeName}</option>}
            {employeeOptions?.results.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isFiltered && <FilterNotice applied={applied} onClear={reset} />}

      {flat ? (
        <div className="space-y-2">
          {isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-etiqueta" />)
          ) : orders.length === 0 && restaurant && shownChecks > 0 ? null : orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <ClipboardList size={32} strokeWidth={1.75} aria-hidden className="mx-auto mb-3" />
              <p className="font-medium text-foreground">{isFiltered ? tf("noResults") : t(`labels.${mode}.empty`)}</p>
              {isFiltered && <p className="mt-1">{tf("noResultsHint")}</p>}
            </div>
          ) : (
            <ul className="space-y-2">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} showPriority={showPriority} />
              ))}
            </ul>
          )}
          {data?.info && data.info.total > 0 && <Pagination info={data.info} onPageChange={setPage} />}
        </div>
      ) : (
        <div className="space-y-8">
          {restaurant && summaryTotal(counts) - (counts?.paid_today ?? 0) > 0 && (
            <p className="border-t border-border pt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{tq("walkIns")}</p>
          )}
          <Group title={t("groups.toCharge")} count={counts?.done} hideEmpty={restaurant} extra={summary ? t("groups.toChargeTotal", { amount: money.format(summary.to_charge_total) }) : undefined}
                 filters={{ status: "done" }} showPriority={showPriority} enabled={gate.enabled} />
          <Group title={t("groups.open")} count={counts?.open} hideEmpty={restaurant} filters={{ status: "open" }} showPriority={showPriority} enabled={gate.enabled} />
          <Group title={t("groups.inProgress")} count={counts?.in_progress} hideEmpty={restaurant} filters={{ status: "in_progress" }} showPriority={showPriority} enabled={gate.enabled} />
          {!restaurant && (
            <Group title={t("groups.unassigned")} count={counts?.unassigned} filters={{ unassigned: true }} showPriority={showPriority} enabled={gate.enabled} />
          )}
          <Group title={restaurant ? tq("paidToday") : t("groups.paidToday")} count={counts?.paid_today} hideEmpty={restaurant} filters={{ status: "paid", paid_on: today }} showPriority={showPriority} enabled={gate.enabled} />
        </div>
      )}

      <OrderForm open={formOpen} onOpenChange={setFormOpen} />
      {isOwner && <OrderModeDialog open={modeOpen} onOpenChange={setModeOpen} />}
    </div>
  );
}

function summaryTotal(counts: { open: number; in_progress: number; done: number; paid_today: number } | undefined): number {
  return counts ? counts.open + counts.in_progress + counts.done + counts.paid_today : 0;
}
