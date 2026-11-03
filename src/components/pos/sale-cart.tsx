"use client";
// La venta en curso (spec 050): renglones con cantidad editable, total en vivo y las acciones de cobrar y descartar.
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductIconBadge } from "@/components/product-icon";
import { categoryColor } from "@/components/take-order/lib";
import type { Sale, SaleItem } from "@/types";
import { formatMoney, nextQuantity } from "./lib";

interface SaleCartProps {
  sale: Sale | null;
  busy: boolean;
  onQuantity: (item: SaleItem, quantity: number) => void;
  onRemove: (item: SaleItem) => void;
  onCharge: () => void;
  onDiscard: () => void;
}

export function SaleCart({ sale, busy, onQuantity, onRemove, onCharge, onDiscard }: SaleCartProps) {
  const t = useTranslations("pos");
  const locale = useLocale();
  const items = sale?.items ?? [];
  const canCharge = !!sale && items.length > 0 && sale.actions?.includes("charge") !== false;
  const total = formatMoney(sale?.total ?? 0, locale);

  return (
    <section aria-label={t("cart.title")} className="flex min-h-0 flex-1 flex-col rounded-etiqueta border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-lg font-extrabold uppercase">{t("cart.title")}</h2>
        <span className="text-sm text-muted-foreground">{t("cart.items", { count: items.length })}</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-semibold">{t("empty.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("empty.body")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <ProductIconBadge product={{ name: item.name, icon: item.icon }} color={categoryColor(item.name)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatMoney(item.unit_price, locale)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1" role="group" aria-label={t("cart.quantity", { name: item.name })}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10"
                    disabled={busy}
                    aria-label={t("cart.decrease", { name: item.name })}
                    onClick={() => onQuantity(item, nextQuantity(item.quantity, -1, item.fractional))}
                  >
                    <Minus size={16} aria-hidden />
                  </Button>
                  <span className="w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                    {item.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10"
                    disabled={busy}
                    aria-label={t("cart.increase", { name: item.name })}
                    onClick={() => onQuantity(item, nextQuantity(item.quantity, 1, item.fractional))}
                  >
                    <Plus size={16} aria-hidden />
                  </Button>
                </div>
                <span className="w-20 text-right text-sm font-semibold tabular-nums">{formatMoney(item.subtotal, locale)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  disabled={busy}
                  aria-label={t("cart.remove", { name: item.name })}
                  onClick={() => onRemove(item)}
                >
                  <Trash2 size={16} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="space-y-3 border-t border-border p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">{t("cart.total")}</span>
          <span className="font-display text-4xl font-extrabold tabular-nums">{total}</span>
        </div>
        <div className="flex gap-2">
          {sale && sale.actions?.includes("discard") !== false && (
            <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={onDiscard}>
              {t("cart.discard")}
            </Button>
          )}
          <Button type="button" className="h-12 flex-1 text-base" disabled={!canCharge || busy} onClick={onCharge}>
            {t("charge.button", { total })}
          </Button>
        </div>
      </footer>
    </section>
  );
}
