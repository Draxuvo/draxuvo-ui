// src/app/[locale]/(dashboard)/inventario/page.tsx
"use client";
import { useRef, useState, useMemo } from "react";
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
import { usePagination } from "@/hooks/use-pagination";
import type { Product } from "@/types";
import { ModuleLocked, useModuleLocked } from "@/components/subscription/module-locked";

const PAGE_SIZE = 10;

export default function InventarioPage() {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { page, goTo, reset } = usePagination();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<"entry" | "exit" | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["products", page, PAGE_SIZE, debouncedSearch],
    queryFn: () => inventoryService.list(page, debouncedSearch, PAGE_SIZE),
  });

  const products: Product[] = data?.results ?? [];
  const lowStockCount = products.filter((p) => p.low_stock).length;

  function handleSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      reset();
    }, 400);
  }

  function closeMovement() {
    setMovementProduct(null);
    setMovementType(null);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-zinc-900">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {t("subtitle", { count: data?.info?.total ?? 0 })}
            {lowStockCount > 0 && (
              <span className="text-amber-500 ml-1">
                {t("lowStockAlert", { count: lowStockCount })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input
          className="pl-8"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={products}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        loadingMessage={tc("loading")}
        emptyMessage={t("empty")}
      />

      {/* Pagination */}
      {data?.info && data.info.total > 0 && (
        <Pagination info={data.info} onPageChange={goTo} />
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
