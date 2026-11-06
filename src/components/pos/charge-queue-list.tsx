"use client";
// Pestaña «Por cobrar» de la caja (spec 058, FR-018): las ventas que los cajeros pasaron a cobro, de la más antigua a la
// más reciente, con cajero, hora, artículos y total. Elegir una la abre en el carrito para cobrarla o regresarla.
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import type { Sale } from "@/types";
import { cn } from "@/lib/utils";
import { formatMoney } from "./lib";

interface ChargeQueueListProps {
  sales: Sale[];
  loading: boolean;
  selectedId: number | null;
  onPick: (sale: Sale) => void;
}

export function ChargeQueueList({ sales, loading, selectedId, onPick }: ChargeQueueListProps) {
  const t = useTranslations("pos.queue");
  const locale = useLocale();

  return (
    <section aria-label={t("tab")} className="flex min-h-0 flex-1 flex-col rounded-etiqueta border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-extrabold uppercase">{t("tab")}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loading && sales.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-semibold">{t("empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {sales.map((sale) => {
              const cashier = sale.opened_by?.name ?? "";
              return (
                <li key={sale.id}>
                  <button
                    type="button"
                    aria-label={t("open", { name: cashier })}
                    aria-current={sale.id === selectedId ? "true" : undefined}
                    onClick={() => onPick(sale)}
                    className={cn(
                      "foco-etiqueta flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      sale.id === selectedId && "bg-muted",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{cashier}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={12} aria-hidden />
                        {sale.submitted_at ? format(new Date(sale.submitted_at), "HH:mm") : ""}
                        {" · "}
                        {t("items", { count: sale.items_count })}
                      </p>
                    </div>
                    <span className="text-base font-semibold tabular-nums">{formatMoney(sale.total, locale)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
