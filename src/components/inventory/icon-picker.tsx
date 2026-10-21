"use client";
// Selector del icono de un producto o de un tipo (spec 026): catálogo agrupado por giro, con buscador y "Quitar icono".
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProductIcon } from "@/components/product-icon";
import { isProductIconKey, PRODUCT_ICON_GROUPS, type ProductIconKey } from "@/lib/product-icons/catalog";
import { cn } from "@/lib/utils";

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

interface IconPickerProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Clave que se usa cuando no hay icono propio (la del tipo), para mostrarla como sugerencia. */
  fallback?: string | null;
}

export function IconPicker({ value, onChange, fallback }: IconPickerProps) {
  const t = useTranslations("productIcons");
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const current = isProductIconKey(value) ? value : null;
  const suggested = isProductIconKey(fallback) ? fallback : null;
  const name = (key: ProductIconKey) => t(`names.${key}`);

  const groups = useMemo(() => {
    const needle = normalize(term);
    return (Object.entries(PRODUCT_ICON_GROUPS) as [keyof typeof PRODUCT_ICON_GROUPS, readonly ProductIconKey[]][])
      .map(([group, keys]) => ({
        group,
        keys: keys.filter((key) => !needle || normalize(t(`names.${key}`)).includes(needle) || key.includes(needle)),
      }))
      .filter((entry) => entry.keys.length > 0);
  }, [term, t]);

  function pick(key: string | null) {
    onChange(key);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-md border border-input bg-muted/40 text-foreground">
        {current ? <ProductIcon name={current} size={22} /> : suggested ? <ProductIcon name={suggested} size={22} className="opacity-40" /> : null}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { setTerm(""); setOpen(true); }}>
          {current ? t("change") : t("pick")}
        </Button>
        {current && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t("remove")}
          </Button>
        )}
        {!current && suggested && <span className="text-xs text-muted-foreground">{t("suggested", { name: name(suggested) })}</span>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="h-10 pl-9" />
          </div>
          {!groups.length && <p className="text-sm text-muted-foreground">{t("noResults")}</p>}
          {groups.map(({ group, keys }) => (
            <section key={group} aria-label={t(`groups.${group}`)} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`groups.${group}`)}</h3>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {keys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={name(key)}
                    aria-pressed={key === current}
                    title={name(key)}
                    onClick={() => pick(key)}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-input p-2 text-[11px] leading-tight hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      key === current && "border-primary bg-accent ring-1 ring-primary",
                    )}
                  >
                    <ProductIcon name={key} size={22} />
                    <span className="line-clamp-1 w-full text-center">{name(key)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
