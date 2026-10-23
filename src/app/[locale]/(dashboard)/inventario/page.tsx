// src/app/[locale]/(dashboard)/inventario/page.tsx
"use client";
import { Suspense, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, RefreshCw, FileUp, FileDown, Shapes, PackagePlus, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { ProductForm } from "@/components/inventory/product-form";
import { ProductDeleteDialog } from "@/components/inventory/product-delete-dialog";
import { StockMovementDialog } from "@/components/inventory/stock-movement-dialog";
import { ProductImportDialog } from "@/components/inventory/product-import-dialog";
import { getProductColumns } from "@/components/inventory/columns";
import { ProductTypesSheet } from "@/components/inventory/product-types-sheet";
import { useProductTypes } from "@/hooks/use-product-types";
import { inventoryService } from "@/services/inventory";
import { getDashboardStats } from "@/services/analytics";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { FilterNotice } from "@/components/filters/filter-notice";
import { SearchInput } from "@/components/filters/search-input";

const PAGE_SIZE = 10;
// `product_type_id` es la pestaña de tipo (spec 016); vacío = Todos.
const DEFAULTS = { low_stock: "", out_of_stock: "", available: "", search: "", product_type_id: "" };
// Solo `true` aplica (contracts/ui-routes.md); cualquier otro valor se ignora.
const ONLY_TRUE = ["true"] as const;
const ALLOWED = { low_stock: ONLY_TRUE, out_of_stock: ONLY_TRUE, available: ONLY_TRUE };

type StockKey = "low_stock" | "out_of_stock" | "available";

const CHIP =
  "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta foco-etiqueta";
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
  const locale = useLocale();
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const role = useAuthStore((s) => s.role);
  const canManageTypes = !!role && ["admin", "owner", "super_admin"].includes(role);
  const [typesOpen, setTypesOpen] = useState(false);
  const { filters, page, setFilter, setFilters, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, {
    allowed: ALLOWED,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<"entry" | "exit" | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Puerta del módulo antes de consultar: fuera del plan no hay request ni toast.
  const gate = useModuleGate("inventory");
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["products", filters, page],
    enabled: gate.enabled,
    queryFn: () =>
      inventoryService.list({
        page,
        page_size: PAGE_SIZE,
        low_stock: filters.low_stock === "true" || undefined,
        out_of_stock: filters.out_of_stock === "true" || undefined,
        available: filters.available === "true" || undefined,
        search: filters.search || undefined,
        product_type_id: filters.product_type_id ? Number(filters.product_type_id) : undefined,
      }),
  });

  // Excel con el inventario y los filtros vigentes (spec 034).
  const exportMutation = useMutation({
    mutationFn: () =>
      inventoryService.exportProducts({
        low_stock: filters.low_stock === "true" || undefined,
        out_of_stock: filters.out_of_stock === "true" || undefined,
        available: filters.available === "true" || undefined,
        search: filters.search || undefined,
        product_type_id: filters.product_type_id ? Number(filters.product_type_id) : undefined,
      }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = t("exportFilename");
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error(t("exportError")),
  });

  const types = useProductTypes({ enabled: gate.enabled });
  const view = types.data?.find((type) => String(type.id) === filters.product_type_id) ?? null;

  // Conteo real de stock bajo (no solo la página cargada), compartido con el dashboard.
  const { data: stats } = useQuery({
    queryKey: ["dashboard", selectedCompanyId],
    queryFn: getDashboardStats,
    staleTime: 60 * 1000,
    enabled: gate.enabled,
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
      }, view, locale),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, locale],
  );

  if (gate.isLocked(error)) return <ModuleLocked module="inventory" />;

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
    view?.name,
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
                className="rounded-full bg-ceja px-2 py-0.5 font-medium text-foreground tabular-nums transition-colors duration-[120ms] hover:bg-ceja/80 foco-etiqueta"
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
          <Button variant="outline" onClick={() => setTypesOpen(true)} className="gap-2">
            <Shapes size={15} />
            {t("types.button")}
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <FileUp size={15} />
            {t("importBtn")}
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/${locale}/inventario/recibir`}>
              <PackagePlus size={15} aria-hidden />
              {t("receive.title")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/${locale}/inventario/conteo`}>
              <ClipboardCheck size={15} aria-hidden />
              {t("count.title")}
            </Link>
          </Button>
          <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} className="gap-2">
            <FileDown size={15} />
            {exportMutation.isPending ? t("exporting") : t("exportButton")}
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
            <Plus size={15} />
            {t("new")}
          </Button>
        </div>
      </div>

      {/* Pestañas por tipo de producto (spec 016) */}
      {(types.data?.length ?? 0) > 0 && (
        <div role="tablist" aria-label={t("types.tabs")} className="flex flex-wrap gap-2 border-b border-border pb-2">
          {[{ id: "", name: t("filters.all") }, ...types.data!.map((type) => ({ id: String(type.id), name: type.name }))].map((tab) => {
            const on = filters.product_type_id === tab.id;
            return (
              <button
                key={tab.id || "all"}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter("product_type_id", tab.id || null)}
                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
              >
                {tab.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={filters.search}
          onSearch={(value) => setFilter("search", value)}
          placeholder={t("searchPlaceholder")}
        />
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

      {isFiltered && <FilterNotice applied={applied} onClear={reset} />}

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
        defaultTypeId={view?.id}
        canEditIcon={canManageTypes}
      />

      {/* Tipos de producto (spec 016) */}
      <ProductTypesSheet open={typesOpen} onOpenChange={setTypesOpen} canManage={canManageTypes} />

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
