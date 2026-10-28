"use client";
// Banda de avisos operativos del restaurante (spec 043, US5 y US6): lo que la cocina o la barra dejó
// listo y las cuentas que quedaron por cobrar. Tocar el aviso abre la cuenta; la X lo descarta.
import { useTranslations } from "next-intl";
import { Bell, Receipt, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RestaurantAlert } from "@/hooks/use-restaurant-alerts";

/** Cuántos avisos se ven a la vez; el resto se resume en un contador. */
export const MAX_VISIBLE_ALERTS = 3;

export function AlertBanner({
  alerts,
  onOpen,
  onDismiss,
}: {
  alerts: RestaurantAlert[];
  onOpen: (alert: RestaurantAlert) => void;
  onDismiss: (key: string) => void;
}) {
  const t = useTranslations("takeOrder");
  if (alerts.length === 0) return null;
  const visible = alerts.slice(0, MAX_VISIBLE_ALERTS);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-2 px-3"
    >
      {visible.map((alert) => {
        const source = alert.kind === "ready" ? alert.item.table ?? alert.item.takeout_name ?? "" : alert.name;
        const item = alert.kind === "ready" && alert.item.quantity > 1 ? `${alert.item.quantity} × ${alert.item.name}` : alert.kind === "ready" ? alert.item.name : "";
        const text =
          alert.kind === "ready" ? t("alertReady", { source, name: item }) : alert.kind === "to_pay" ? t("alertToPay", { source }) : t("alertTableTaken", { source });
        const Icon = alert.kind === "ready" ? Bell : alert.kind === "to_pay" ? Receipt : Users;
        return (
          <div
            key={alert.key}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-etiqueta border p-1.5 pl-3 shadow-etiqueta",
              alert.kind === "ready"
                ? "border-estado-completada-border bg-estado-completada text-estado-completada-foreground"
                : "border-estado-pendiente-border bg-estado-pendiente text-estado-pendiente-foreground",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(alert)}
              aria-label={t("alertOpen", { text })}
              className="foco-etiqueta flex min-h-11 flex-1 items-center gap-2 text-left font-semibold"
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className="min-w-0 truncate">{text}</span>
            </button>
            <button
              type="button"
              onClick={() => onDismiss(alert.key)}
              aria-label={t("alertDismiss")}
              className="foco-etiqueta flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        );
      })}
      {alerts.length > MAX_VISIBLE_ALERTS && (
        <p className="pointer-events-auto rounded-full bg-foreground/80 px-3 py-1 text-sm font-semibold text-background">
          +{alerts.length - MAX_VISIBLE_ALERTS}
        </p>
      )}
    </div>
  );
}
