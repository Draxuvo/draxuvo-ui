"use client";
// Plano de mesas (o de órdenes abiertas): un mosaico por mesa con su estado en color y en texto.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Selection, SourceTile } from "./use-order-source";

export function TablePlan({
  tiles,
  mode,
  selection,
  loading,
  error,
  onPick,
  onCreate,
}: {
  tiles: SourceTile[];
  mode: "restaurant" | "orders";
  selection: Selection;
  loading: boolean;
  error: boolean;
  onPick: (tile: SourceTile) => void;
  onCreate: (name: string) => void;
}) {
  const t = useTranslations("takeOrder");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const isSelected = (tile: SourceTile) =>
    !!selection && !!tile.selection && tile.selection.kind === selection.kind && tile.selection.id === selection.id;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
    setNaming(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="text-sm text-destructive">{t("loadError")}</p>}
      {loading && !tiles.length && <p className="text-sm text-muted-foreground">…</p>}
      {!loading && !error && !tiles.length && (
        <p className="text-sm text-muted-foreground">{mode === "restaurant" ? t("noTables") : t("noOrders")}</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => {
          const state = tile.state === "free" ? t("free") : t("occupied");
          const label =
            tile.state === "occupied"
              ? t("tableAria", { name: tile.name, state, total: money.format(tile.total) })
              : t("tileAria", { name: tile.name, state });
          return (
            <button
              key={tile.key}
              type="button"
              aria-label={label}
              aria-pressed={isSelected(tile)}
              onClick={() => onPick(tile)}
              className={cn(
                "flex min-h-[88px] flex-col items-start justify-between rounded-lg border p-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tile.state === "free"
                  ? "border-input bg-card hover:bg-accent"
                  : "border-transparent bg-primary/10 hover:bg-primary/15",
                isSelected(tile) && "ring-2 ring-primary",
              )}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="font-display text-lg font-extrabold leading-tight">{tile.name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    tile.state === "free" ? "bg-success/15 text-success" : "bg-primary text-primary-foreground",
                  )}
                >
                  {state}
                </span>
              </span>
              {tile.state === "occupied" && (
                <span className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{money.format(tile.total)}</span>
                  {tile.owner && <> · {tile.mine ? t("mine") : tile.owner}</>}
                </span>
              )}
            </button>
          );
        })}
        {!naming && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-sm text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={18} aria-hidden />
            {mode === "restaurant" ? t("newTakeout") : t("newOrder")}
          </button>
        )}
      </div>
      {naming && (
        <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-input p-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === "restaurant" ? t("newNamePlaceholder") : t("newNameOrderPlaceholder")}
            aria-label={mode === "restaurant" ? t("newNamePlaceholder") : t("newNameOrderPlaceholder")}
            className="h-11"
          />
          <div className="flex gap-2">
            <Button type="submit" className="min-h-11 flex-1" disabled={!name.trim()}>{t("newCreate")}</Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => { setNaming(false); setName(""); }}>
              {t("newCancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
