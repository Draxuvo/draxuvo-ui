// src/app/[locale]/(dashboard)/inventario/page.tsx
"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, RefreshCw, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ProductForm } from "@/components/inventory/product-form";
import { ProductDeleteDialog } from "@/components/inventory/product-delete-dialog";
import { StockMovementDialog } from "@/components/inventory/stock-movement-dialog";
import { ProductImportDialog } from "@/components/inventory/product-import-dialog";
import { getProductColumns } from "@/components/inventory/columns";
import { inventoryService } from "@/services/inventory";
import { getDashboardStats } from "@/services/analytics";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { ModuleLocked, useModuleLocked } from "@/components/subscription/module-locked";

const PAGE_SIZE = 10;
const DEFAULTS = { low_stock: "", out_of_stock: "", available: "", search: "" };
// Solo `true` aplica (contracts/ui-routes.md); cualquier otro valor se ignora.
const ONLY_TRUE = ["true"] as const;
const ALLOWED = { low_stock: ONLY_TRUE, out_of_stock: ONLY_TRUE, available: ONLY_TRUE };

type StockKey = "low_stock" | "out_of_stock" | "available";

const CHIP =
  "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF = "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground";

export default function InventarioPage() {
  return (
    <Suspense>
      <InventarioContent />
    </Suspense>
  );
}

function InventarioContent() {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const tf = useTranslations("common.filters");
  const ta = useTranslations("analyticsBoard");
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const { filters, page, setFilter, setFilters, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, {
    allowed: ALLOWED,
  });

  // Búsqueda: borrador local con debounce de 400 ms hacia la URL.
  const [draft, setDraft] = useState(filters.search);
  const [synced, setSynced] = useState(filters.search);
  if (synced !== filters.search) {
    setSynced(filters.search);
    if (draft.trim() !== filters.search) setDraft(filters.search);
  }
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);
  function handleSearch(value: string) {
    setDraft(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilter("search", value), 400);
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<"entry" | "exit" | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["products", filters, page],
    queryFn: () =>
      inventoryService.list({
        page,
        page_size: PAGE_SIZE,
        low_stock: filters.low_stock === "true" || undefined,
        out_of_stock: filters.out_of_stock === "true" || undefined,
        available: filters.available === "true" || undefined,
        search: filters.search || undefined,
      }),
  });

  // Conteo real de stock bajo (no solo la página cargada), compartido con el dashboard.
  const { data: stats } = useQuery({
    queryKey: ["dashboard", selectedCompanyId],
    queryFn: getDashboardStats,
    staleTime: 60 * 1000,
  });

  const products: Product[] = data?.results ?? [];

  function closeMovement() {
    setMovementProduct(null);
    setMovementType(null);
  }

  // Una sola opción de existencias a la vez: stock bajo y agotados son excluyentes.
  function selectStock(key: StockKey | null) {
    setFilters({
      low_stock: key === "low_stock" ? "true" : null,
      out_of_stock: key === "out_of_stock" ? "true" : null,
      available: key === "available" ? "true" : null,
    });
  }

  const columns = useMemo(
    () =>
      getProductColumns(t, tc, {
        onEntry: (p) => { setMovementProduct(p); setMovementType("entry"); },
        onExit: (p) => { setMovementProduct(p); setMovementType("exit"); },
        onEdit: (p) => { setEditing(p); setFormOpen(true); },
        onDelete: (p) => setDeleting(p),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const locked = useModuleLocked("inventory", error);
  if (locked) return <ModuleLocked module="inventory" />;

  const stockOptions: { key: StockKey | null; label: string }[] = [
    { key: null, label: t("filters.all") },
    { key: "low_stock", label: t("filters.lowStock") },
    { key: "out_of_stock", label: t("filters.outOfStock") },
    { key: "available", label: t("filters.available") },
  ];
  const noStockFilter = !filters.low_stock && !filters.out_of_stock && !filters.available;
  const applied = [
    filters.low_stock && t("filters.lowStock"),
    filters.out_of_stock && t("filters.outOfStock"),
    filters.available && t("filters.available"),
    filters.search && `"${filters.search}"`,
  ].filter(Boolean);
  const lowStockTotal = stats?.inventory.low_stock ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{t("title")}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {isFiltered
              ? tf("results", { count: data?.info?.total ?? 0 })
              : t("subtitle", { count: data?.info?.total ?? 0 })}
            {!isFiltered && lowStockTotal > 0 && (
              <button
                type="button"
                onClick={() => selectStock("low_stock")}
                className="rounded-full bg-ceja px-2 py-0.5 font-medium text-foreground tabular-nums outline-none transition-colors duration-[120ms] hover:bg-ceja/80 focus-visible:ring-2 focus-visible:ring-foreground"
              >
                {ta("subset.lowStock", { count: lowStockTotal })}
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={tc("refresh")}
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <FileUp size={15} />
            {t("importBtn")}
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
            <Plus size={15} />
            {t("new")}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-card pl-8"
            type="search"
            aria-label={tc("search")}
            placeholder={t("searchPlaceholder")}
            value={draft}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div role="group" aria-label={t("filters.stock")} className="flex flex-wrap gap-2">
          {stockOptions.map((o) => {
            const on = o.key ? filters[o.key] === "true" : noStockFilter;
            return (
              <button
                key={o.key ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => selectStock(o.key)}
                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {isFiltered && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-card px-3 py-2 text-sm shadow-etiqueta"
        >
          <span className="rounded-full bg-ceja px-2 py-0.5 font-medium text-foreground">
            {tf("applied", { filters: applied.join(" · ") })}
          </span>
          <button
            type="button"
            onClick={reset}
            className="rounded-[6px] px-1 font-medium text-foreground underline decoration-border underline-offset-4 outline-none transition-colors duration-[120ms] hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-foreground"
          >
            {tf("clear")}
          </button>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={products}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        loadingMessage={tc("loading")}
        emptyMessage={isFiltered ? tf("noResults") : t("empty")}
      />

      {/* Pagination */}
      {data?.info && data.info.total > 0 && (
        <Pagination info={data.info} onPageChange={setPage} />
      )}

      {/* Form Sheet */}
      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
      />

      {/* Delete Dialog */}
      <ProductDeleteDialog
        product={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />

      {/* Stock Movement Dialog */}
      <StockMovementDialog
        product={movementProduct}
        movementType={movementType}
        onOpenChange={(open) => !open && closeMovement()}
      />

      {/* Import Dialog */}
      <ProductImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
