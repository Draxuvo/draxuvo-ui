// src/components/restaurant/station-summary.tsx
"use client";
// Resumen de la estación (spec 032): cuántas comandas hay, cuántos artículos están en preparación y la más lenta.
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BoardOrder } from "@/types";
import { formatMinutes } from "./table-tile";
import { minutesSince } from "./station-card";

export function stationStats(orders: BoardOrder[], now: number) {
  const preparing = orders.reduce((sum, order) => sum + order.items.filter((item) => item.status === "preparing").length, 0);
  const slowest = orders.length ? Math.max(...orders.map((order) => minutesSince(order.sent_at, now))) : null;
  return { total: orders.length, preparing, slowest };
}

export function StationSummary({ orders, now, slowAfter }: { orders: BoardOrder[]; now: number; slowAfter: number }) {
  const t = useTranslations("restaurant.station");
  const { total, preparing, slowest } = stationStats(orders, now);
  return (
    <ul aria-label={t("summary")} aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
      <li className="rounded-full bg-muted px-3 py-1 text-foreground">{t("pending", { count: total })}</li>
      <li className="rounded-full bg-muted px-3 py-1 text-foreground">{t("preparing", { count: preparing })}</li>
      {slowest != null && (
        <li
          className={cn(
            "rounded-full px-3 py-1 tabular-nums",
            slowest >= slowAfter ? "bg-estado-pendiente text-estado-pendiente-foreground" : "bg-muted text-foreground",
          )}
        >
          {t("slowest", { time: slowest === 0 ? t("elapsedNow") : formatMinutes(slowest) })}
        </li>
      )}
    </ul>
  );
}
