"use client";
// Menú de tarjetas agrupadas por categoría, con buscador y barra para saltar de categoría.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProductIconBadge } from "@/components/product-icon";
import { cn } from "@/lib/utils";
import { categoryColor, filterMenu, type MenuCard, type MenuSection } from "./lib";

/** Fila de categorías con desplazamiento: si no caben, aparecen flechas y ninguna queda cortada sin salida. */
function CategoryChips({ sections, onJump }: { sections: MenuSection[]; onJump: (category: string) => void }) {
  const t = useTranslations("takeOrder");
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, sections]);

  const scroll = (direction: -1 | 1) =>
    row.current?.scrollBy?.({ left: direction * Math.max(160, row.current.clientWidth * 0.7), behavior: "smooth" });

  return (
    <nav aria-label={t("categories")} className="flex items-center gap-1">
      {edges.left && (
        <button type="button" aria-label={t("categoriesBack")} onClick={() => scroll(-1)} className="foco-etiqueta flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card">
          <ChevronLeft size={16} aria-hidden />
        </button>
      )}
      <div ref={row} onScroll={measure} className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none]">
        {sections.map((s) => (
          <button
            key={s.category}
            type="button"
            onClick={() => onJump(s.category)}
            className="foco-etiqueta inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm hover:bg-muted"
          >
            <span aria-hidden className="size-2 rounded-full" style={{ background: categoryColor(s.category) }} />
            {s.category}
          </button>
        ))}
      </div>
      {edges.right && (
        <button type="button" aria-label={t("categoriesForward")} onClick={() => scroll(1)} className="foco-etiqueta flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card">
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
    </nav>
  );
}

export function MenuGrid({
  menu,
  loading,
  error,
  disabled,
  countOf,
  onTap,
}: {
  menu: MenuSection[];
  loading: boolean;
  error: boolean;
  /** Sin orden elegida o cerrada: las tarjetas no agregan. */
  disabled: boolean;
  countOf: (card: MenuCard) => number;
  onTap: (card: MenuCard) => void;
}) {
  const t = useTranslations("takeOrder");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const [term, setTerm] = useState("");
  const sections = useMemo(() => filterMenu(menu, term), [menu, term]);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const jump = (category: string) => refs.current[category]?.scrollIntoView?.({ behavior: "smooth", block: "start" });

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="h-11 pl-9 pr-10"
        />
        {term && (
          <button
            type="button"
            aria-label={t("searchClear")}
            onClick={() => setTerm("")}
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      {sections.length > 1 && <CategoryChips sections={sections} onJump={jump} />}

      {error && <p role="alert" className="text-sm text-destructive">{t("menuLoadError")}</p>}
      {!loading && !error && !menu.length && <p className="text-sm text-muted-foreground">{t("menuEmpty")}</p>}
      {!!menu.length && !sections.length && <p className="text-sm text-muted-foreground">{t("noResults")}</p>}

      <div className="flex flex-col gap-5">
        {sections.map((section) => (
          <section key={section.category} ref={(el) => { refs.current[section.category] = el; }} className="scroll-mt-2">
            <h3 className="mb-2 font-display text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              {section.category}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {section.items.map((card) => {
                const count = countOf(card);
                const off = !!card.sold_out;
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={off || disabled}
                    aria-label={t("productAria", { name: card.name, price: money.format(card.price) })}
                    onClick={() => onTap(card)}
                    className={cn(
                      "relative flex min-h-[96px] flex-col items-start justify-between gap-2 rounded-lg border border-input bg-card p-3 text-left transition-colors",
                      "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      (off || disabled) && "opacity-50 hover:bg-card",
                    )}
                  >
                    <span className="flex w-full items-start gap-2">
                      <ProductIconBadge product={card} color={categoryColor(section.category)} />
                      <span className="line-clamp-2 text-sm font-medium leading-tight">{card.name}</span>
                    </span>
                    <span className="flex w-full items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{money.format(card.price)}</span>
                      {off ? (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{t("soldOut")}</span>
                      ) : card.low ? (
                        <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs">{t("low")}</span>
                      ) : null}
                    </span>
                    {count > 0 && (
                      <span
                        aria-label={t("inOrder", { count })}
                        className="absolute -right-1.5 -top-1.5 flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground"
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
