// src/app/[locale]/(dashboard)/ordenes/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkOrders, useDeleteWorkOrder } from "@/hooks/use-work-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ClipboardList, Search, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { WorkOrder, WorkOrderFilters, WorkOrderStatus } from "@/types";
import { ModuleLocked, useModuleLocked } from "@/components/subscription/module-locked";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";

const STATUS_FILTERS = [
  "all",
  "pending",
  "in_progress",
  "in_review",
  "completed",
  "cancelled",
];

const ADMIN_ROLES = ["admin", "owner", "super_admin"] as const;

export default function OrdenesPage() {
  const t = useTranslations("workOrders");
  const locale = useLocale();
  const dateLocale = locale === "es" ? es : enUS;
  const user = useAuthStore((s) => s.user);
  const isAdmin = ADMIN_ROLES.includes(user?.role as typeof ADMIN_ROLES[number]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [toDelete, setToDelete] = useState<WorkOrder | null>(null);

  const deleteOrder = useDeleteWorkOrder();

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  const filters: WorkOrderFilters = {};
  if (statusFilter !== "all") filters.status = statusFilter as WorkOrderStatus;
  if (debouncedSearch) filters.search = debouncedSearch;

  const { data, isLoading, isFetching, refetch, error } = useWorkOrders(filters);
  const orders = data?.results ?? [];

  const locked = useModuleLocked("work_orders", error);
  if (locked) return <ModuleLocked module="work_orders" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-zinc-900">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {t("subtitle", { count: orders.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={15} className="mr-2" />
            {t("new")}
          </Button>
        </div>
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === s
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {s === "all" ? t("all") : t(`statuses.${s}`)}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <Input
          placeholder={t("searchPlaceholder")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista de órdenes */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            {t("noOrders")}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            <ClipboardList size={32} className="mx-auto mb-3 text-zinc-300" />
            {t("noOrders")}
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelected(order)}
              className="bg-white border border-zinc-200 rounded-xl p-4 cursor-pointer hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PriorityBadge priority={order.priority} />
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="font-medium text-zinc-900 truncate">
                    {order.title}
                  </p>
                  {order.description && (
                    <p className="text-sm text-zinc-400 truncate mt-0.5">
                      {order.description}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2 flex-shrink-0">
                  <div className="text-right">
                    {order.due_date && (
                      <p className="text-xs text-zinc-400">
                        {format(new Date(order.due_date), "dd MMM", {
                          locale: dateLocale,
                        })}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {order.employee?.name ?? t("unassigned")}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete(order);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {order.items_count > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>{t("items")}</span>
                    <span>
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
          <p className="text-sm text-zinc-500">
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
