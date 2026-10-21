"use client";
// Elige un producto del catálogo para la orden de trabajo (spec 026). Reemplaza al <select> nativo porque este no
// admite iconos en sus opciones: diálogo con buscador y una fila por producto con su icono, nombre y precio.
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProductGlyph } from "@/components/product-icon";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function ProductPicker({
  products,
  value,
  onChange,
}: {
  products: Product[];
  /** Id del producto elegido (como texto) o "". */
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("workOrders.concepts");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const selected = products.find((p) => String(p.id) === value);
  const shown = useMemo(() => {
    const needle = normalize(term);
    return needle ? products.filter((p) => normalize(`${p.name} ${p.sku}`).includes(needle)) : products;
  }, [products, term]);

  return (
    <>
      <button
        type="button"
        aria-label={t("addFromCatalog")}
        aria-haspopup="dialog"
        onClick={() => { setTerm(""); setOpen(true); }}
        className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-etiqueta border border-input bg-card px-3 text-left text-base foco-etiqueta"
      >
        {selected && <ProductGlyph product={selected} className="text-muted-foreground" />}
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.name : t("productPlaceholder")}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pickerTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("pickerTitle")}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("pickerSearch")} aria-label={t("pickerSearch")} className="h-11 pl-9" />
          </div>
          {!shown.length && <p className="text-sm text-muted-foreground">{t("pickerEmpty")}</p>}
          <ul className="divide-y divide-border">
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { onChange(String(p.id)); setOpen(false); }}
                  className={cn("flex min-h-12 w-full items-center gap-3 px-1 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", String(p.id) === value && "bg-accent")}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ProductGlyph product={p} size={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.price != null && <span className="text-sm tabular-nums text-muted-foreground">{money.format(Number(p.price))}</span>}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
