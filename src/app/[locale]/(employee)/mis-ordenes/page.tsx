// src/app/[locale]/(employee)/mis-ordenes/page.tsx
// Órdenes asignadas al empleado, pensadas para el celular: una columna, tarjetas grandes y
// botones de 44 px. La API ya limita la lista a sus órdenes (404 en las ajenas). "Nueva orden" abre el
// formulario del operador (spec 015): la orden queda asignada a su empleado.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format, isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { ClipboardList, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStartOrder, useWorkOrders } from "@/hooks/use-work-orders";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { PriorityBadge } from "@/components/work-orders/priority-badge";
import { ProgressBar } from "@/components/work-orders/progress-bar";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { OrderForm } from "@/components/work-orders/order-form";
import { useScreenMode } from "@/components/take-order/use-screen-mode";
import { ClosedChecks, OpenChecks, useClosedChecks, useOpenChecks } from "@/components/take-order/open-checks";
import { useAppRouter } from "@/hooks/use-router";
import type { WorkOrder } from "@/types";

function OrderCard({ order }: { order: WorkOrder }) {
  const t = useTranslations("workOrders");
  const ts = useTranslations("workOrders.staff");
  const locale = useLocale();
  const start = useStartOrder(order.id);
  const pending = order.steps_count - order.steps_done;
  const due = order.due_date ? new Date(order.due_date) : null;
  const active = order.status === "open" || order.status === "in_progress";

  return (
    <li className="rounded-etiqueta border border-border bg-card shadow-etiqueta">
      <Link
        href={`/${locale}/mis-ordenes/${order.id}`}
        className="block min-h-16 space-y-2 p-4 foco-etiqueta rounded-etiqueta"
        aria-label={`${ts("open")}: ${order.title}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {active && <PriorityBadge priority={order.priority} />}
          {due && active && (isToday(due) || isPast(due)) && (
            <span className="rounded-full bg-estado-pendiente px-2.5 py-1 text-xs font-semibold text-estado-pendiente-foreground">
              {isToday(due) ? t("dueToday") : t("overdue")}
            </span>
          )}
        </div>
        <p className="font-heading text-xl leading-tight font-semibold">{order.title}</p>
        {order.customer_name && <p className="text-base text-muted-foreground">{order.customer_name}</p>}
        {order.customer_address && (
          <p className="flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {order.customer_address}
          </p>
        )}
        {due && active && <p className="text-sm text-muted-foreground">{format(due, "d MMM, HH:mm")}</p>}
        {order.steps_count > 0 && active && (
          <div className="space-y-1">
            <ProgressBar steps_done={order.steps_done} steps_count={order.steps_count} />
            {pending > 0 && <p className="text-sm text-muted-foreground">{ts("pendingSteps", { count: pending })}</p>}
          </div>
        )}
      </Link>
      {order.status === "open" && (
        <div className="px-4 pb-4">
          <Button
            className="h-12 w-full text-base"
            disabled={start.isPending}
            aria-label={ts("startAria", { title: order.title })}
            onClick={() => start.mutate(undefined, { onSuccess: () => toast.success(t("started")), onError: () => toast.error(t("errors.invalid_transition")) })}
          >
            {t("actions.start")}
          </Button>
        </div>
      )}
    </li>
  );
}

function Group({ title, orders }: { title: string; orders: WorkOrder[] }) {
  if (orders.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">
        {title} <span className="text-muted-foreground tabular-nums">({orders.length})</span>
      </h2>
      <ul className="space-y-3">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ul>
    </section>
  );
}

export default function MisOrdenesPage() {
  const t = useTranslations("workOrders");
  const ts = useTranslations("workOrders.staff");
  const gate = useModuleGate("work_orders");
  const today = format(new Date(), "yyyy-MM-dd");
  const [formOpen, setFormOpen] = useState(false);
  const router = useAppRouter();
  // Con restaurante o en modo pedido, "nueva orden" abre la pantalla visual (spec 018).
  const { mode: screen } = useScreenMode();
  // Con mesas, sus cuentas abiertas viven aquí junto a sus órdenes (spec 020).
  const openChecks = useOpenChecks("mine");
  const closedChecks = useClosedChecks("mine");
  const newOrder = () => (screen !== "none" ? router.push("/pedido") : setFormOpen(true));

  // sort_by=urgency es el orden por defecto de staff en la API: lo urgente y lo que vence hoy, primero.
  const { data, isLoading, error } = useWorkOrders({ sort_by: "urgency" }, { page_size: 100 }, { enabled: gate.enabled });
  const { data: paid } = useWorkOrders({ status: "paid", paid_on: today }, { page_size: 100 }, { enabled: gate.enabled });

  if (gate.isLocked(error)) return <ModuleLocked module="work_orders" />;

  const all = data?.results ?? [];
  const todo = all.filter((o) => o.status === "open" || o.status === "in_progress");
  const finished = [...all.filter((o) => o.status === "done"), ...(paid?.results ?? [])];

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{t("myOrders")}</h1>
          <p className="text-sm text-muted-foreground">{t("myOrdersSubtitle", { count: todo.length })}</p>
        </div>
        <Button className="min-h-11 shrink-0 gap-1.5" onClick={newOrder}>
          <Plus size={16} aria-hidden="true" />
          {ts("newOrder")}
        </Button>
      </header>
      <OrderForm open={formOpen} onOpenChange={setFormOpen} staff />
      <OpenChecks checks={openChecks} from="mis-ordenes" />
      <ClosedChecks checks={closedChecks} from="mis-ordenes" title={ts("finished")} />

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-etiqueta" />
          ))}
        </div>
      ) : error ? (
        <p role="alert" className="text-destructive">
          {t("loadError")}
        </p>
      ) : todo.length === 0 && finished.length === 0 && openChecks.length === 0 && closedChecks.length === 0 ? (
        <div className="py-16 text-center">
          <ClipboardList size={36} className="mx-auto mb-3 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-medium">{ts("empty")}</p>
          <p className="text-sm text-muted-foreground">{ts("emptyDesc")}</p>
        </div>
      ) : (
        <>
          <Group title={ts("active")} orders={todo} />
          <Group title={ts("finished")} orders={finished} />
        </>
      )}
    </div>
  );
}
