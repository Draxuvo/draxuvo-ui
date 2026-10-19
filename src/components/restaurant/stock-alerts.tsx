// src/components/restaurant/stock-alerts.tsx
"use client";
import { useTranslations } from "next-intl";
import { useStockAlerts } from "@/hooks/use-restaurant";

/** Productos controlados agotados o en su mínimo (FR-042). Es un estado: desaparece al reponer. */
export function StockAlerts({ enabled }: { enabled: boolean }) {
  const t = useTranslations("restaurant");
  const { data } = useStockAlerts({ enabled });

  return (
    <section aria-labelledby="stock-alerts-title" className="space-y-3">
      <h2 id="stock-alerts-title" className="font-display text-xl font-extrabold">
        {t("stockAlerts")}
      </h2>
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("stockAlertsEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card">
          {data.map((alert) => (
            <li key={alert.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{alert.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("stockLeft", { stock: alert.stock, min: alert.min_stock ?? 0 })}
                </p>
              </div>
              <span
                className={
                  alert.sold_out
                    ? "shrink-0 rounded-full bg-estado-cancelada px-2.5 py-1 text-xs font-semibold text-estado-cancelada-foreground"
                    : "shrink-0 rounded-full bg-estado-pendiente px-2.5 py-1 text-xs font-semibold text-estado-pendiente-foreground"
                }
              >
                {alert.sold_out ? t("soldOut") : t("lowStock")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
