"use client";
// La venta en curso (spec 050): renglones con cantidad editable, total en vivo y las acciones de cobrar y descartar.
// Spec 058: con «Cobro solo por jefes» el cajero ve «Pasar a cobro» y un aviso en lugar de Cobrar; una venta lista para
// cobro queda en solo lectura para él, y el jefe puede regresarla.
import { useLocale, useTranslations } from "next-intl";
import { Clock, Minus, Plus, ShieldCheck, Trash2, Undo2 } from "lucide-react";
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
  /** Spec 058: el cajero pasa la venta a cobro. */
  onSubmit?: () => void;
  /** Spec 058: un jefe regresa la venta al cajero. */
  onReturn?: () => void;
  /** Spec 058: abre una venta nueva (desde una venta que ya espera cobro). */
  onNewSale?: () => void;
}

export function SaleCart({ sale, busy, onQuantity, onRemove, onCharge, onDiscard, onSubmit, onReturn, onNewSale }: SaleCartProps) {
  const t = useTranslations("pos");
  const locale = useLocale();
  const items = sale?.items ?? [];
  const actions = sale?.actions;
  const bossOnly = sale?.charge_blocked_reason === "boss_only";
  const waiting = bossOnly && !!sale?.submitted_at;
  // Sin acciones (venta nueva aún sin pedir) se permite, como antes; con acciones, solo lo que trae la API.
  const editable = !actions || actions.includes("add_item");
  const canCharge = !!sale && !bossOnly && items.length > 0 && actions?.includes("charge") !== false;
  const canSubmit = !!sale && bossOnly && !waiting && items.length > 0 && !!actions?.includes("submit");
  const canReturn = !!actions?.includes("return");
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
                    disabled={busy || !editable}
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
                    disabled={busy || !editable}
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
                  disabled={busy || !editable}
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
        {sale?.submitted_at && canReturn && sale.opened_by && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock size={14} aria-hidden />
            {t("bossOnly.submittedBy", { name: sale.opened_by.name })}
          </p>
        )}
        {waiting ? (
          <div role="status" className="space-y-3 rounded-etiqueta border border-border bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 font-semibold">
              <Clock size={16} aria-hidden />
              {t("bossOnly.waiting")}
            </p>
            <p className="text-sm text-muted-foreground">{t("bossOnly.waitingBody")}</p>
            {onNewSale && (
              <Button type="button" className="h-12 w-full text-base" onClick={onNewSale}>
                <Plus size={16} aria-hidden />
                {t("newSale")}
              </Button>
            )}
          </div>
        ) : (
          <>
            {bossOnly && (
              <p role="note" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck size={16} aria-hidden />
                {t("bossOnly.notice")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {sale && actions?.includes("discard") !== false && (
                <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={onDiscard}>
                  {t("cart.discard")}
                </Button>
              )}
              {canReturn && onReturn && (
                <Button type="button" variant="outline" className="h-12 gap-1.5" disabled={busy} onClick={onReturn}>
                  <Undo2 size={16} aria-hidden />
                  {t("bossOnly.returnToCashier")}
                </Button>
              )}
              {bossOnly ? (
                <Button type="button" className="h-12 flex-1 text-base" disabled={!canSubmit || busy} onClick={onSubmit}>
                  {t("bossOnly.submit")}
                </Button>
              ) : (
                <Button type="button" className="h-12 flex-1 text-base" disabled={!canCharge || busy} onClick={onCharge}>
                  {t("charge.button", { total })}
                </Button>
              )}
            </div>
          </>
        )}
      </footer>
    </section>
  );
}
