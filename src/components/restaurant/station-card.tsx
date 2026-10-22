// src/components/restaurant/station-card.tsx
"use client";
import { useTranslations } from "next-intl";
import { Check, ChefHat, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoardItem, BoardOrder } from "@/types";

/** Pasados estos minutos la comanda se marca como lenta. */
export const SLOW_AFTER_MINUTES = 10;

export function minutesSince(sentAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(sentAt).getTime()) / 60_000));
}

function ItemRow({
  item,
  pending,
  onAdvance,
}: {
  item: BoardItem;
  pending: boolean;
  onAdvance: (id: number) => void;
}) {
  const t = useTranslations("restaurant.station");
  const cancelled = item.status === "cancelled";
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 space-y-1">
        <p className={cn("text-xl font-semibold leading-tight", cancelled && "line-through text-muted-foreground")}>
          <span className="font-display tabular-nums">{item.quantity}</span> × {item.name}
        </p>
        {item.note && (
          <p className="rounded-etiqueta bg-estado-pendiente px-2 py-1 text-base font-semibold text-estado-pendiente-foreground">
            {item.note}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{t(`status.${item.status}`)}</p>
      </div>
      {!cancelled && (
        <Button
          type="button"
          size="lg"
          disabled={pending}
          variant={item.status === "new" ? "outline" : "default"}
          onClick={() => onAdvance(item.id)}
          className="min-h-14 min-w-28 shrink-0 text-base"
          aria-label={`${item.status === "new" ? t("prepare") : t("ready")}: ${item.name}`}
        >
          {item.status === "new" ? <ChefHat aria-hidden className="size-5" /> : <Check aria-hidden className="size-5" />}
          {item.status === "new" ? t("prepare") : t("ready")}
        </Button>
      )}
    </li>
  );
}

export function StationCard({
  order,
  now,
  pending,
  onAdvanceItem,
  onAdvanceAll,
}: {
  order: BoardOrder;
  now: number;
  pending: boolean;
  onAdvanceItem: (itemId: number) => void;
  onAdvanceAll: (orderId: number) => void;
}) {
  const t = useTranslations("restaurant.station");
  const minutes = minutesSince(order.sent_at, now);
  const slow = minutes >= SLOW_AFTER_MINUTES;
  const actionable = order.items.filter((item) => item.status === "new" || item.status === "preparing");
  const title = order.table ? t("table", { name: order.table }) : t("takeout", { name: order.takeout_name ?? "" });

  return (
    <article
      aria-label={`${title}, ${t("comanda", { number: order.number })}`}
      className={cn(
        "rounded-etiqueta border bg-card p-4 shadow-etiqueta",
        slow ? "border-estado-pendiente-border" : "border-border",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-3xl font-extrabold leading-none">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("comanda", { number: order.number })}
            {order.waiter ? ` · ${t("waiter", { name: order.waiter })}` : ""}
          </p>
        </div>
        <p
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-lg font-semibold tabular-nums",
            slow ? "bg-estado-pendiente text-estado-pendiente-foreground" : "bg-muted text-foreground",
          )}
        >
          <Clock aria-hidden className="size-4" />
          {minutes === 0 ? t("elapsedNow") : t("elapsed", { minutes })}
        </p>
      </header>
      <ul className="mt-2 divide-y divide-border">
        {order.items.map((item) => (
          <ItemRow key={item.id} item={item} pending={pending} onAdvance={onAdvanceItem} />
        ))}
      </ul>
      {actionable.length > 1 && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={() => onAdvanceAll(order.id)}
          className="mt-3 min-h-12 w-full text-base"
        >
          {t("markAll")}
        </Button>
      )}
    </article>
  );
}
