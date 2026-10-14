// src/app/[locale]/(employee)/mis-ordenes/page.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWorkOrders } from "@/hooks/use-work-orders";
import { WorkOrderDetail } from "@/components/work-orders/work-order-detail";
import { WorkOrderDialog } from "@/components/work-orders/work-order-dialog";
import { PriorityBadge } from "@/components/work-orders/priority-badge";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { ProgressBar } from "@/components/work-orders/progress-bar";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus } from "lucide-react";
import type { WorkOrder } from "@/types";
import { format } from "date-fns";

export default function MisOrdenesPage() {
  const t = useTranslations("workOrders");
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // El backend ya filtra por el empleado autenticado
  const { data, isLoading } = useWorkOrders();
  const orders = data?.results ?? [];

  const active = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const completed = orders.filter((o) => o.status === "completed");
  const cancelled = orders.filter((o) => o.status === "cancelled");

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-zinc-900">{t("myOrders")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {active.length} activas · {completed.length} completadas
            {cancelled.length > 0 && ` · ${cancelled.length} canceladas`}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={15} className="mr-2" />
          {t("new")}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-zinc-400">
          {t("noOrders")}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <ClipboardList size={36} className="mx-auto mb-3 text-zinc-300" />
          <p className="text-sm text-zinc-400">{t("noOrders")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Activas */}
          {active.map((order) => (
            <OrderCard key={order.id} order={order} onClick={() => setSelected(order)} />
          ))}

          {/* Completadas */}
          {completed.length > 0 && (
            <>
              {active.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-zinc-100" />
                  <span className="text-xs text-zinc-400">Completadas</span>
                  <div className="flex-1 h-px bg-zinc-100" />
                </div>
              )}
              {completed.map((order) => (
                <OrderCard key={order.id} order={order} onClick={() => setSelected(order)} dimmed />
              ))}
            </>
          )}

          {/* Canceladas */}
          {cancelled.length > 0 && (
            <>
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-zinc-100" />
                <span className="text-xs text-red-300">Canceladas</span>
                <div className="flex-1 h-px bg-zinc-100" />
              </div>
              {cancelled.map((order) => (
                <OrderCard key={order.id} order={order} onClick={() => setSelected(order)} dimmed />
              ))}
            </>
          )}
        </div>
      )}

      <WorkOrderDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {selected && (
        <WorkOrderDetail
          order={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function OrderCard({
  order,
  onClick,
  dimmed,
}: {
  order: WorkOrder;
  onClick: () => void;
  dimmed?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 cursor-pointer transition-colors hover:border-zinc-300 ${
        dimmed ? "opacity-60 border-zinc-100" : "border-zinc-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PriorityBadge priority={order.priority} />
            <StatusBadge status={order.status} />
          </div>
          <p className="font-medium text-zinc-900">{order.title}</p>
          {order.description && (
            <p className="text-sm text-zinc-400 mt-0.5 line-clamp-1">
              {order.description}
            </p>
          )}
        </div>
        {order.due_date && (
          <span className="text-xs text-zinc-400 flex-shrink-0">
            {format(new Date(order.due_date), "dd MMM")}
          </span>
        )}
      </div>

      {order.items_count > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>
              {order.items_done}/{order.items_count} tareas
            </span>
            <span>{order.progress}%</span>
          </div>
          <ProgressBar value={order.progress} />
        </div>
      )}
    </div>
  );
}
