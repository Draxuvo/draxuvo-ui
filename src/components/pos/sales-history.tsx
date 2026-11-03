"use client";
// Historial de ventas de mostrador (spec 050, FR-053): filtros por estado, fechas y búsqueda por folio o artículo; abre
// el detalle con el ticket. Dueño y administrador ven todas las ventas; el personal, solo las suyas (lo recorta la API).
import { Suspense, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { CHIP, CHIP_OFF, CHIP_ON } from "@/components/filters/chip";
import { FilterNotice } from "@/components/filters/filter-notice";
import { SearchInput } from "@/components/filters/search-input";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { useSales } from "@/hooks/use-sales";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { cn } from "@/lib/utils";
import type { SaleStatus } from "@/types";
import { formatMoney } from "./lib";
import { SaleDetailDialog } from "./sale-detail-dialog";

const PAGE_SIZE = 20;
const STATUSES: SaleStatus[] = ["open", "paid", "cancelled"];
const DEFAULTS = { status: "", search: "", from: "", to: "" };
const ALLOWED = { status: STATUSES };
const DATE_LOCALES = { es, en: enUS };

export function SalesHistory({ mine = false }: { mine?: boolean }) {
  return (
    <Suspense>
      <Content mine={mine} />
    </Suspense>
  );
}

function Content({ mine }: { mine: boolean }) {
  const t = useTranslations("pos.history");
  const tf = useTranslations("common.filters");
  const locale = useLocale() as "es" | "en";
  const { filters, page, setFilter, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, { allowed: ALLOWED });
  const [openId, setOpenId] = useState<number | null>(null);

  const gate = useModuleGate("pos");
  const { data, isLoading, error } = useSales(
    {
      page,
      page_size: PAGE_SIZE,
      status: (filters.status || undefined) as SaleStatus | undefined,
      search: filters.search || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    },
    gate.enabled,
  );
  const sales = data?.results ?? [];

  if (gate.isLocked(error)) return <ModuleLocked module="pos" />;

  const applied = [
    filters.status && `${t("status")}: ${t(`statuses.${filters.status as SaleStatus}`)}`,
    filters.search && `"${filters.search}"`,
    filters.from && `${t("from")}: ${filters.from}`,
    filters.to && `${t("to")}: ${filters.to}`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">{mine ? t("mineTitle") : t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFiltered ? tf("results", { count: data?.info?.total ?? 0 }) : t("subtitle", { count: data?.info?.total ?? 0 })}
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 gap-2">
          <Link href={`/${locale}/venta`}>
            <ShoppingCart size={16} aria-hidden />
            {t("newSale")}
          </Link>
        </Button>
      </div>

      <div role="group" aria-label={t("filterStatus")} className="flex flex-wrap gap-2">
        {["", ...STATUSES].map((value) => {
          const on = filters.status === value;
          return (
            <button key={value || "all"} type="button" aria-pressed={on} onClick={() => setFilter("status", value || null)} className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}>
              {value ? t(`statuses.${value as SaleStatus}`) : t("all")}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SearchInput value={filters.search} onSearch={(value) => setFilter("search", value)} placeholder={t("searchPlaceholder")} className="min-w-56 flex-1" />
        <div>
          <label htmlFor="sales-from" className="block text-xs font-medium text-muted-foreground">
            {t("from")}
          </label>
          <Input id="sales-from" type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value || null)} className="h-10" />
        </div>
        <div>
          <label htmlFor="sales-to" className="block text-xs font-medium text-muted-foreground">
            {t("to")}
          </label>
          <Input id="sales-to" type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value || null)} className="h-10" />
        </div>
      </div>

      {isFiltered && <FilterNotice applied={applied} onClear={reset} />}

      {error && (
        <div role="alert" className="rounded-etiqueta border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {t("loadError")}
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} aria-hidden className="h-16 animate-pulse rounded-etiqueta bg-card shadow-etiqueta" />)
        ) : sales.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{isFiltered ? tf("noResults") : t("empty")}</p>
        ) : (
          sales.map((sale) => (
            <button
              key={sale.id}
              type="button"
              onClick={() => setOpenId(sale.id)}
              className="flex w-full items-center justify-between gap-3 rounded-etiqueta border border-transparent bg-card p-4 text-left shadow-etiqueta transition-colors hover:border-foreground/40 foco-etiqueta"
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs font-semibold text-muted-foreground">{sale.folio ?? `#${sale.id}`}</span>
                <span className="block truncate font-medium">
                  {t("items", { count: sale.items_count })}
                  {sale.opened_by && ` · ${t("cashier")}: ${sale.opened_by.name}`}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {format(new Date(sale.paid_at ?? sale.created_at), "d MMM yyyy HH:mm", { locale: DATE_LOCALES[locale] })}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-display text-xl font-semibold tabular-nums">{formatMoney(sale.total, locale)}</span>
                <span className="block text-xs text-muted-foreground">{sale.status === "open" ? t("openDraft") : sale.status_label}</span>
              </span>
            </button>
          ))
        )}
      </div>

      {data?.info && data.info.pages_total > 1 && <Pagination info={data.info} onPageChange={setPage} />}

      <SaleDetailDialog saleId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
