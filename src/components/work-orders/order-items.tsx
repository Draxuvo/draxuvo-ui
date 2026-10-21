"use client";
// Conceptos cobrables y total. Agregar viene de `add_item` (staff solo del catálogo, sin precio propio);
// editar precio y borrar vienen de `edit_items`; el asignado cambia la cantidad y quita con `change_items` (spec 015).
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductGlyph } from "@/components/product-icon";
import { apiClient } from "@/lib/api";
import { ProductPicker } from "./product-picker";
import { useAddItem, useDeleteItem, useUpdateItem } from "@/hooks/use-work-orders";
import type { Product, WorkOrder, WorkOrderAction } from "@/types";

export function OrderItems({ order }: { order: WorkOrder }) {
  const t = useTranslations("workOrders");
  const locale = useLocale();
  const can = (action: WorkOrderAction) => order.allowed_actions?.includes(action) ?? false;
  const boss = can("edit_items");
  const changeQuantity = !boss && can("change_items");
  const canRemove = boss || can("change_items");
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const [productId, setProductId] = useState("");
  const [free, setFree] = useState({ description: "", quantity: "1", unit_price: "" });

  const { data: productsData } = useQuery({
    queryKey: ["products-selector"],
    queryFn: () => apiClient.get("/api/v1/products?page_size=100&sellable=true").then((r) => r.data),
    enabled: can("add_item"),
  });
  const products: Product[] = productsData?.results ?? productsData ?? [];

  const add = useAddItem(order.id);
  const update = useUpdateItem(order.id);
  const remove = useDeleteItem(order.id);
  const items = order.items ?? [];

  function addFromCatalog() {
    if (!productId) return;
    add.mutate({ product_id: Number(productId), quantity: 1 }, {
      onSuccess: () => setProductId(""),
      onError: () => toast.error(t("errors.forbidden")),
    });
  }

  function addFree(event: React.FormEvent) {
    event.preventDefault();
    if (!free.description.trim()) return;
    add.mutate(
      { description: free.description.trim(), quantity: Number(free.quantity) || 1, unit_price: Number(free.unit_price) || 0 },
      { onSuccess: () => setFree({ description: "", quantity: "1", unit_price: "" }) },
    );
  }

  return (
    <section aria-labelledby="order-items-title" className="space-y-3">
      <h2 id="order-items-title" className="font-heading text-lg font-semibold">
        {t("concepts.title")}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("concepts.empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex min-w-0 items-center gap-3 px-3 py-2">
              {item.product && <ProductGlyph product={item.product} size={20} className="text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base">{item.description}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {item.quantity} {item.unit ?? ""} × {money.format(Number(item.unit_price ?? 0))}
                </p>
              </div>
              {boss ? (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  defaultValue={Number(item.unit_price ?? 0)}
                  aria-label={t("concepts.editPrice")}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value !== Number(item.unit_price ?? 0)) update.mutate({ itemId: item.id, data: { unit_price: value } });
                  }}
                  className="h-11 w-28 text-right tabular-nums"
                />
              ) : changeQuantity ? (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step="1"
                  defaultValue={Number(item.quantity)}
                  aria-label={t("concepts.editQuantity", { description: item.description })}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value > 0 && value !== Number(item.quantity)) update.mutate({ itemId: item.id, data: { quantity: value } });
                  }}
                  className="h-11 w-20 text-right tabular-nums"
                />
              ) : (
                <p className="font-display text-lg font-semibold tabular-nums">{money.format(Number(item.subtotal ?? 0))}</p>
              )}
              {canRemove && (
                <button
                  type="button"
                  onClick={() => remove.mutate(item.id)}
                  aria-label={t("concepts.deleteAria", { description: item.description })}
                  className="grid size-11 shrink-0 place-items-center rounded-etiqueta text-muted-foreground hover:text-destructive foco-etiqueta"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-baseline justify-between font-display text-2xl font-extrabold tabular-nums">
        <span className="font-sans text-base font-medium">{t("concepts.total")}</span>
        {money.format(Number(order.total ?? 0))}
      </p>

      {can("add_item") && (
        <div className="space-y-3 rounded-etiqueta border border-dashed border-border p-3">
          <div className="flex gap-2">
            <ProductPicker products={products} value={productId} onChange={setProductId} />
            <Button type="button" variant="outline" className="h-11 gap-1" onClick={addFromCatalog} disabled={!productId || add.isPending}>
              <Plus size={16} aria-hidden="true" />
              {t("concepts.add")}
            </Button>
          </div>
          {boss && (
            <form onSubmit={addFree} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_4rem_6rem_auto]">
              <Input
                value={free.description}
                onChange={(e) => setFree({ ...free, description: e.target.value })}
                placeholder={t("concepts.freePlaceholder")}
                aria-label={t("concepts.freeDescription")}
                className="col-span-2 h-11 sm:col-span-1"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={free.quantity}
                onChange={(e) => setFree({ ...free, quantity: e.target.value })}
                aria-label={t("concepts.quantity")}
                className="h-11"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={free.unit_price}
                onChange={(e) => setFree({ ...free, unit_price: e.target.value })}
                placeholder={t("concepts.price")}
                aria-label={t("concepts.price")}
                className="h-11"
              />
              <Button type="submit" variant="outline" className="h-11" disabled={add.isPending}>
                {t("concepts.addFree")}
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
