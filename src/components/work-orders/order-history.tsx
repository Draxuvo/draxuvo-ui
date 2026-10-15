"use client";
// Historia de la orden: qué pasó, quién y cuándo. Las notas y las fotos son eventos.
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
    };
    const name = event.actor?.name ?? t("history.system");
    switch (event.kind) {
      case "finished":
        return data.pending_steps ? t("history.finishedPending", { name, count: data.pending_steps }) : t("history.finished", { name });
      case "charged":
        return t("history.charged", { name, folio: data.folio ?? "", method: tc(`methods.${data.payment_method ?? "cash"}`) });
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
