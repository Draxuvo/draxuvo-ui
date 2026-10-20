"use client";
// Historia de la orden: qué pasó, quién y cuándo. Las notas, las fotos, los cambios de productos y los pagos
// anulados (spec 015) son eventos.
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import type { WorkOrder, WorkOrderEvent } from "@/types";

export function OrderHistory({ order }: { order: WorkOrder }) {
  const t = useTranslations("workOrders");
  const tc = useTranslations("tickets");
  const locale = useLocale();
  const dateLocale = locale === "en" ? enUS : es;
  const events = order.events ?? [];

  function label(event: WorkOrderEvent): string {
    const data = event.data as {
      pending_steps?: number; folio?: string; payment_method?: string; reason?: string;
      from?: { name: string } | null; to?: { name: string } | null;
      description?: string; quantity?: number | string; from_quantity?: number | string; to_quantity?: number | string;
    };
    const name = event.actor?.name ?? t("history.system");
    switch (event.kind) {
      case "finished":
        return data.pending_steps ? t("history.finishedPending", { name, count: data.pending_steps }) : t("history.finished", { name });
      case "charged":
        return t("history.charged", { name, folio: data.folio ?? "", method: tc(`methods.${data.payment_method ?? "cash"}`) });
      case "item_added":
      case "item_removed":
        return t(`history.${event.kind}`, { name, product: data.description ?? "", quantity: Number(data.quantity ?? 0) });
      case "item_updated":
        return t("history.item_updated", {
          name, product: data.description ?? "", from: Number(data.from_quantity ?? 0), to: Number(data.to_quantity ?? 0),
        });
      case "voided":
      case "cancelled":
        return t(`history.${event.kind}`, { name, reason: data.reason ?? "" });
      case "reassigned":
        if (!data.from) return t("history.reassignedFromNone", { name, to: data.to?.name ?? "" });
        if (!data.to) return t("history.reassignedToNone", { name, from: data.from.name });
        return t("history.reassigned", { name, from: data.from.name, to: data.to.name });
      default:
        return t(`history.${event.kind}`, { name });
    }
  }

  return (
    <section aria-labelledby="order-history-title" className="space-y-3">
      <h2 id="order-history-title" className="font-heading text-lg font-semibold">
        {t("history.title")}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-border pl-4">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span aria-hidden="true" className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full bg-foreground" />
              <p className="text-base">{label(event)}</p>
              {event.kind === "note" && <p className="text-base text-muted-foreground">{String((event.data as { text?: string }).text ?? "")}</p>}
              {event.kind === "voided" && <VoidedPayments event={event} />}
              <p className="text-sm text-muted-foreground">
                {format(new Date(event.created_at), "d MMM, HH:mm", { locale: dateLocale })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Pagos que quedaron anulados con el cobro (spec 015, FR-014).
function VoidedPayments({ event }: { event: WorkOrderEvent }) {
  const t = useTranslations("workOrders");
  const tc = useTranslations("tickets");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const payments = (event.data as { payments?: { method: string; amount: number | string }[] }).payments ?? [];
  if (payments.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {t("history.voidedPayments", {
        payments: payments.map((p) => `${tc(`methods.${p.method}`)} ${money.format(Number(p.amount))}`).join(", "),
      })}
    </p>
  );
}
