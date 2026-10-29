// src/components/inventory/columns.tsx
"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProductGlyph } from "@/components/product-icon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatQuantity } from "@/lib/quantity";
import type { Product, ProductTypeRef } from "@/types";

/** Selección de filas para generar códigos e imprimir etiquetas (spec 035); sobrevive a la paginación. */
export interface ProductSelection {
  isSelected: (id: number) => boolean;
  toggle: (product: Product) => void;
  pageAll: boolean;
  pageSome: boolean;
  togglePage: () => void;
  labels: { row: (name: string) => string; page: string };
}

interface ProductActions {
  onEntry: (product: Product) => void;
  onExit: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

/**
 * Columnas según la vista (spec 016): en "Todos" se muestra el tipo; en un tipo que no se cuenta no hay existencia
 * ni entradas y salidas; en uno que no se vende no hay precio.
 */
export function getProductColumns(
  t: (key: string) => string,
  tc: (key: string) => string,
  actions: ProductActions,
  view?: ProductTypeRef | null,
  locale = "es",
  selection?: ProductSelection,
): ColumnDef<Product, unknown>[] {
  const showStock = !view || view.counted;
  const showPrice = !view || view.sellable;
  const money = (value: number | undefined) => (value === undefined || value === null ? "—" : `$${Number(value).toFixed(2)}`);
  const columns: (ColumnDef<Product, unknown> | false)[] = [
    !!selection && {
      id: "select",
      header: () => (
        <label className="grid size-10 cursor-pointer place-items-center md:size-6">
          <input
            type="checkbox"
            aria-label={selection.labels.page}
            checked={selection.pageAll}
            ref={(el) => {
              if (el) el.indeterminate = selection.pageSome && !selection.pageAll;
            }}
            onChange={selection.togglePage}
            className="size-4 rounded border-border accent-primary"
          />
        </label>
      ),
      cell: ({ row }) => (
        <label className="grid size-10 cursor-pointer place-items-center md:size-6">
          <input
            type="checkbox"
            aria-label={selection.labels.row(row.original.name)}
            checked={selection.isSelected(row.original.id)}
            onChange={() => selection.toggle(row.original)}
            className="size-4 rounded border-border accent-primary"
          />
        </label>
      ),
    },
    {
      accessorKey: "sku",
      header: t("sku"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.sku}</span>
      ),
    },
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <ProductGlyph product={row.original} className="text-muted-foreground" />
          <div className="min-w-0">
            <span className="font-medium text-foreground">{row.original.name}</span>
            {!!row.original.barcodes?.length && (
              <span className="block font-mono text-xs text-muted-foreground tabular-nums">
                {row.original.barcodes[0]}
                {row.original.barcodes.length > 1 ? ` +${row.original.barcodes.length - 1}` : ""}
              </span>
            )}
          </div>
          {row.original.low_stock && (
            <Badge
              variant="secondary"
              className="text-estado-pendiente-foreground bg-estado-pendiente border-estado-pendiente-border text-xs"
            >
              <AlertTriangle size={11} className="mr-1" aria-hidden="true" />
              {t("lowStockBadge")}
            </Badge>
          )}
        </div>
      ),
    },
    !view && {
      id: "type",
      header: t("type"),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.product_type?.name ?? "—"}</span>,
    },
    showStock && {
      accessorKey: "stock",
      header: t("stock"),
      cell: ({ row }) => (
        <span className="text-foreground tabular-nums">{formatQuantity(row.original.stock, row.original.unit, locale)}</span>
      ),
    },
    showStock && !!view && {
      accessorKey: "min_stock",
      header: t("minStock"),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{formatQuantity(row.original.min_stock, row.original.unit, locale)}</span>
      ),
    },
    showPrice && {
      accessorKey: "price",
      header: t("price"),
      cell: ({ row }) => <span className="text-foreground tabular-nums">{row.original.product_type?.sellable === false ? "—" : money(row.original.price)}</span>,
    },
    {
      accessorKey: "unit_cost",
      header: t("unitCost"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {money(row.original.unit_cost)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="flex justify-end">{t("actions")}</span>,
      cell: ({ row }) => (
        <TooltipProvider>
          <div className="flex items-center justify-end gap-1">
            {row.original.product_type?.counted !== false && (<>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-estado-completada-foreground"
                  aria-label={`${t("entry")}: ${row.original.name}`}
                  onClick={() => actions.onEntry(row.original)}
                >
                  <ArrowDownToLine size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("entry")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-estado-pendiente-foreground"
                  aria-label={`${t("exit")}: ${row.original.name}`}
                  onClick={() => actions.onExit(row.original)}
                >
                  <ArrowUpFromLine size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("exit")}</TooltipContent>
            </Tooltip>
            </>)}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`${tc("edit")}: ${row.original.name}`}
                  onClick={() => actions.onEdit(row.original)}
                >
                  <Pencil size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tc("edit")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`${tc("delete")}: ${row.original.name}`}
                  onClick={() => actions.onDelete(row.original)}
                >
                  <Trash2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tc("delete")}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      ),
    },
  ];
  return columns.filter((column): column is ColumnDef<Product, unknown> => Boolean(column));
}
