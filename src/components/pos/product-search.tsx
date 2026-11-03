"use client";
// Búsqueda y escaneo de la caja (spec 050): el campo de la pistola mantiene el foco y debajo hay un buscador con
// tarjetas del catálogo vendible. Tocar una tarjeta o escanear un código agrega el producto a la venta.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScanField } from "@/components/inventory/scan/scan-field";
import { ProductIconBadge } from "@/components/product-icon";
import { categoryColor } from "@/components/take-order/lib";
import { useSalesCatalog } from "@/hooks/use-sales";
import { cn } from "@/lib/utils";
import type { SaleCatalogProduct } from "@/types";
import { formatMoney } from "./lib";

interface ProductSearchProps {
  onScan: (code: string) => Promise<void> | void;
  onPick: (product: SaleCatalogProduct) => void;
  disabled?: boolean;
  /** Cambia para devolver el foco al campo de escaneo (por ejemplo al cerrar el cobro). */
  focusSignal?: number;
}

export function ProductSearch({ onScan, onPick, disabled = false, focusSignal = 0 }: ProductSearchProps) {
  const t = useTranslations("pos");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useSalesCatalog(search.trim());
  const products = data?.results ?? [];

  return (
    <section aria-label={t("search.label")} className="flex min-h-0 flex-1 flex-col gap-3">
      <ScanField onScan={onScan} disabled={disabled} focusSignal={focusSignal} />
      <div className="relative">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          className="h-11 pl-9"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {isError ? (
          <p className="p-4 text-sm text-destructive">{t("search.error")}</p>
        ) : isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">{t("search.loading")}</p>
        ) : products.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("search.noResults")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {products.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(product)}
                  className={cn(
                    "foco-etiqueta flex min-h-20 w-full items-center gap-3 rounded-etiqueta border border-border bg-card p-3 text-left transition-colors hover:bg-muted disabled:opacity-50",
                  )}
                >
                  <ProductIconBadge product={{ name: product.name, icon: product.icon }} color={categoryColor(product.category ?? product.name)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{product.name}</span>
                    <span className="block text-sm tabular-nums">{formatMoney(product.price, locale)}</span>
                    {product.stock !== null && (
                      <span className={cn("block text-xs", product.stock > 0 ? "text-muted-foreground" : "text-destructive")}>
                        {product.stock > 0 ? t("stock.left", { count: product.stock }) : t("stock.out")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
