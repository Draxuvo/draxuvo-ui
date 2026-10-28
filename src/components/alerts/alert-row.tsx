// src/components/alerts/alert-row.tsx — una alerta con su tipo, tiempo, responsable y enlace al elemento (spec 045).
"use client";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Armchair, ClipboardList, Package, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AlertKind, OperationalAlert, SnoozeMinutes, SnoozedAlert } from "@/types";
import { SnoozeMenu } from "./snooze-menu";
import { useElapsed } from "./use-elapsed";

const ICONS: Record<AlertKind, LucideIcon> = {
  kitchen_wait: UtensilsCrossed,
  kitchen_preparing: UtensilsCrossed,
  work_order_stalled: ClipboardList,
  table_open: Armchair,
  low_stock: Package,
};

/** A dónde lleva "Abrir": la cuenta en Tomar pedido, la orden, o el producto en el inventario. */
export function alertHref(alert: OperationalAlert, locale: string): string {
  const { subject } = alert;
  if (subject.type === "work_order") return `/${locale}/ordenes/${subject.id}`;
  if (subject.type === "product") return `/${locale}/inventario?search=${encodeURIComponent(subject.label)}`;
  return `/${locale}/pedido?cuenta=${subject.check_id ?? subject.id}`;
}

interface Props {
  alert: OperationalAlert | SnoozedAlert;
  /** Solo en las pospuestas: quita la posposición. */
  onUnsnooze?: () => void;
  onSnooze?: (minutes: SnoozeMinutes) => void;
  busy?: boolean;
}

function isSnoozed(alert: OperationalAlert | SnoozedAlert): alert is SnoozedAlert {
  return "snoozed_until" in alert;
}

export function AlertRow({ alert, onSnooze, onUnsnooze, busy }: Props) {
  const t = useTranslations("alerts");
  const locale = useLocale();
  const format = useFormatter();
  const elapsed = useElapsed();
  const Icon = ICONS[alert.kind];
  const critical = alert.severity === "critical";
  const snoozed = isSnoozed(alert) ? alert : null;
  const snoozable = alert.kind !== "low_stock";

  const owner = alert.owner ? t(`owner.${alert.owner.type}`, { name: alert.owner.name }) : null;
  const detail =
    alert.kind === "low_stock"
      ? t("stock", { stock: alert.stock ?? 0, min: alert.min_stock ?? 0 })
      : t("elapsed", { time: elapsed(alert.minutes ?? 0), limit: elapsed(alert.threshold_minutes ?? 0) });
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const total = alert.total != null ? t("total", { amount: money.format(Number(alert.total)) }) : null;

  return (
    <li
      data-severity={alert.severity}
      data-kind={alert.kind}
      className={cn("flex flex-wrap items-center gap-3 rounded-etiqueta border border-border bg-card p-3 sm:flex-nowrap", snoozed && "opacity-75")}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-etiqueta",
          critical ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
        )}
        aria-hidden="true"
      >
        <Icon size={18} strokeWidth={1.75} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{alert.subject.label}</p>
        <p className="text-xs text-muted-foreground">
          {t(`kinds.${alert.kind}`)}
          {owner ? ` · ${owner}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {detail}
          {total ? ` · ${total}` : ""}
        </p>
        {snoozed && (
          <p className="text-xs text-muted-foreground">
            {t("snooze.until", { time: format.dateTime(new Date(snoozed.snoozed_until), { hour: "2-digit", minute: "2-digit" }) })}
            {snoozed.snoozed_by ? ` · ${t("snooze.by", { name: snoozed.snoozed_by })}` : ""}
          </p>
        )}
      </div>

      <Badge variant={critical ? "destructive" : "secondary"}>{t(`severity.${alert.severity}`)}</Badge>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="outline" size="sm" className="min-h-11">
          <Link href={alertHref(alert, locale)}>{t("open")}</Link>
        </Button>
        {snoozed && onUnsnooze && (
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onUnsnooze} disabled={busy}>
            {t("snooze.undo")}
          </Button>
        )}
        {!snoozed && snoozable && onSnooze && <SnoozeMenu onSnooze={onSnooze} disabled={busy} />}
      </div>
    </li>
  );
}
