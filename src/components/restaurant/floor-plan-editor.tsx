// src/components/restaurant/floor-plan-editor.tsx
"use client";
// Mesas como plano editable (spec 032): se editan con un toque y se reordenan con flechas, sin arrastrar.
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRestaurantTables, useTableMutations } from "@/hooks/use-restaurant";
import type { DiningTable } from "@/types";

export function FloorPlanEditor({ enabled, onEdit }: { enabled: boolean; onEdit: (table: DiningTable | null) => void }) {
  const t = useTranslations("restaurant");
  const tables = useRestaurantTables({ enabled });
  const { update } = useTableMutations();
  const list = tables.data ?? [];

  /** Reordena renumerando solo las mesas cuya posición cambia. */
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    const changes = next
      .map((table, position) => ({ table, position: position + 1 }))
      .filter(({ table, position }) => table.position !== position);
    await Promise.all(changes.map(({ table, position }) => update.mutateAsync({ id: table.id, data: { position } })));
  }

  return (
    <section aria-labelledby="tables-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="tables-title" className="font-display text-xl font-extrabold">
            {t("tables")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("tablesHint")}</p>
        </div>
        <Button onClick={() => onEdit(null)} className="gap-2">
          <Plus size={16} aria-hidden />
          {t("newTable")}
        </Button>
      </div>
      {tables.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : list.length === 0 ? (
        <div className="space-y-2 rounded-etiqueta border border-dashed border-border p-6">
          <p className="font-semibold text-foreground">{t("noTables")}</p>
          <p className="text-sm text-muted-foreground">{t("firstTableHint")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {list.map((table, index) => (
            <li
              key={table.id}
              className={cn(
                "flex flex-col gap-2 rounded-etiqueta border bg-card p-3",
                table.active ? "border-border" : "border-dashed border-border text-muted-foreground",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn("min-w-0 truncate font-display text-xl font-extrabold", !table.active && "line-through")}>
                  {table.name}
                </span>
                {!table.active && <span className="shrink-0 text-xs font-semibold">{t("inactiveBadge")}</span>}
              </div>
              <div className="mt-auto flex items-center gap-1">
                <Button
                  variant="outline" size="icon" className="size-9"
                  aria-label={`${t("moveBefore")}: ${table.name}`}
                  disabled={index === 0 || update.isPending}
                  onClick={() => void move(index, -1)}
                >
                  <ArrowLeft size={14} aria-hidden />
                </Button>
                <Button
                  variant="outline" size="icon" className="size-9"
                  aria-label={`${t("moveAfter")}: ${table.name}`}
                  disabled={index === list.length - 1 || update.isPending}
                  onClick={() => void move(index, 1)}
                >
                  <ArrowRight size={14} aria-hidden />
                </Button>
                <Button
                  variant="ghost" size="icon" className="ml-auto size-9"
                  aria-label={`${t("editTable")}: ${table.name}`}
                  onClick={() => onEdit(table)}
                >
                  <Pencil size={14} aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
