// src/app/[locale]/(dashboard)/ordenes/page.tsx
"use client";
import { Suspense, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useWorkOrders, useDeleteWorkOrder } from "@/hooks/use-work-orders";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PriorityBadge } from "@/components/work-orders/priority-badge";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { ProgressBar } from "@/components/work-orders/progress-bar";
import { WorkOrderDialog } from "@/components/work-orders/work-order-dialog";
import { WorkOrderDetail } from "@/components/work-orders/work-order-detail";
import { ClipboardList, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type WorkOrder,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/types";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { FilterNotice } from "@/components/filters/filter-notice";
import { SearchInput } from "@/components/filters/search-input";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { employeesService } from "@/services/employees";
import { getDashboardStats } from "@/services/analytics";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const DEFAULTS = { status: "", priority: "", employee_id: "", search: "" };
const ALLOWED = { status: WORK_ORDER_STATUSES, priority: WORK_ORDER_PRIORITIES };
const ID_PATTERN = /^\d+$/;

const ADMIN_ROLES = ["admin", "owner", "super_admin"] as const;

const CHIP =
  "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta foco-etiqueta";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF = "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground";
const SELECT =
  "h-9 w-full rounded-etiqueta border border-input bg-card px-2.5 text-sm text-foreground transition-colors duration-[120ms] hover:border-foreground/40 foco-etiqueta sm:w-auto";

export default function OrdenesPage() {
  return (
    <Suspense>
      <OrdenesContent />
    </Suspense>
  );
}

function OrdenesContent() {
  const t = useTranslations("workOrders");
  const tc = useTranslations("common");
  const tf = useTranslations("common.filters");
  const locale = useLocale();
  const dateLocale = locale === "es" ? es : enUS;
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const role = useAuthStore((s) => s.role);
  const isAdmin = ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]);

  const { filters, page, setFilter, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, {
    allowed: ALLOWED,
  });
  // employee_id: solo ids numéricos; otro valor se ignora.
  const employeeId = ID_PATTERN.test(filters.employee_id) ? filters.employee_id : "";

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [toDelete, setToDelete] = useState<WorkOrder | null>(null);

  const deleteOrder = useDeleteWorkOrder();

  // Puerta del módulo antes de consultar: con el plan sin órdenes no hay request ni toast.
  const gate = useModuleGate("work_orders");
  const { data, isLoading, isFetching, refetch, error } = useWorkOrders(
    {
      status: (filters.status || undefined) as WorkOrderStatus | undefined,
      priority: (filters.priority || undefined) as WorkOrderPriority | undefined,
      employee_id: employeeId ? Number(employeeId) : undefined,
      search: filters.search || undefined,
    },
    { page, page_size: PAGE_SIZE },
    { enabled: gate.enabled },
  );
  const orders = data?.results ?? [];

  // Opciones de empleado: solo si el módulo de personal está activo (evita un 403).
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

  if (gate.isLocked(error)) return <ModuleLocked module="work_orders" />;

  const employeeName =
    employeeOptions?.results.find((e) => String(e.id) === employeeId)?.name ?? `#${employeeId}`;
  const applied = [
    filters.status && `${t("status")}: ${t(`statuses.${filters.status as WorkOrderStatus}`)}`,
    filters.priority && `${t("priority")}: ${t(`priorities.${filters.priority as WorkOrderPriority}`)}`,
    employeeId && `${t("employee")}: ${employeeName}`,
    filters.search && `"${filters.search}"`,
  ].filter(Boolean);
  const statusChips: { value: string; label: string }[] = [
    { value: "", label: t("all") },
    ...WORK_ORDER_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
  ];

  return (
    <div className="space-y-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFiltered
              ? tf("results", { count: data?.info?.total ?? 0 })
              : t("subtitle", { count: data?.info?.total ?? 0 })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={tc("refresh")}
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus size={15} />
            {t("new")}
          </Button>
        </div>
      </div>

      {/* Filtro de estado */}
      <div role="group" aria-label={t("filterStatus")} className="flex flex-wrap gap-2">
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

      {/* Búsqueda, prioridad y empleado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={filters.search}
          onSearch={(value) => setFilter("search", value)}
          placeholder={t("searchPlaceholder")}
        />
        <select
          aria-label={t("filterPriority")}
          className={SELECT}
          value={filters.priority}
          onChange={(e) => setFilter("priority", e.target.value || null)}
        >
          <option value="">{t("allPriorities")}</option>
          {WORK_ORDER_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t(`priorities.${p}`)}
            </option>
          ))}
        </select>
        {(hasEmployees || employeeId) && (
          <select
            aria-label={t("filterEmployee")}
            className={SELECT}
            value={employeeId}
            onChange={(e) => setFilter("employee_id", e.target.value || null)}
          >
            <option value="">{t("allEmployees")}</option>
            {employeeId && !employeeOptions?.results.some((e) => String(e.id) === employeeId) && (
              <option value={employeeId}>{employeeName}</option>
            )}
            {employeeOptions?.results.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isFiltered && <FilterNotice applied={applied} onClear={reset} />}

      {/* Lista de órdenes */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} aria-hidden className="h-24 animate-pulse rounded-etiqueta bg-card shadow-etiqueta" />
          ))
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <ClipboardList size={32} strokeWidth={1.75} aria-hidden className="mx-auto mb-3" />
            {isFiltered ? (
              <>
                <p className="font-medium text-foreground">{tf("noResults")}</p>
                <p className="mt-1">{tf("noResultsHint")}</p>
              </>
            ) : (
              t("noOrders")
            )}
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(order)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(order);
                }
              }}
              className="cursor-pointer rounded-etiqueta border border-transparent bg-card p-4 shadow-etiqueta transition-colors duration-[120ms] ease-etiqueta hover:border-foreground/40 foco-etiqueta"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <PriorityBadge priority={order.priority} />
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="truncate font-medium text-foreground">{order.title}</p>
                  {order.description && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{order.description}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-start gap-2">
                  <div className="text-right">
                    {order.due_date && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(order.due_date), "dd MMM", { locale: dateLocale })}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.employee?.name ?? t("unassigned")}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      aria-label={t("delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete(order);
                      }}
                      className="rounded-etiqueta p-1.5 text-muted-foreground transition-colors duration-[120ms] hover:bg-destructive/10 hover:text-destructive foco-etiqueta"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {order.items_count > 0 && (
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{t("items")}</span>
                    <span className="tabular-nums">
                      {order.items_done}/{order.items_count}
                    </span>
                  </div>
                  <ProgressBar value={order.progress} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {data?.info && data.info.total > 0 && (
        <Pagination info={data.info} onPageChange={setPage} />
      )}

      <WorkOrderDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {selected && (
        <WorkOrderDetail
          order={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}

      <Dialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("deleteConfirm", { title: toDelete?.title ?? "" })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteOrder.isPending}
              onClick={() => {
                if (!toDelete) return;
                deleteOrder.mutate(toDelete.id, {
                  onSuccess: () => {
                    toast.success(t("deleteSuccess"));
                    setToDelete(null);
                  },
                });
              }}
            >
              {deleteOrder.isPending ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
