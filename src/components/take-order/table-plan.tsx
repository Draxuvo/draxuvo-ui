"use client";
// Plano de mesas (o de órdenes abiertas): una pieza por mesa con su estado, tiempo abierta y total (spec 032).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableTile } from "@/components/restaurant/table-tile";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";
import type { Selection, SourceTile } from "./use-order-source";

type Scope = "all" | "mine";

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
  const now = useNow();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>("all");

  const isSelected = (tile: SourceTile) =>
    !!selection && !!tile.selection && tile.selection.kind === selection.kind && tile.selection.id === selection.id;

  // "Mis mesas": las cuentas propias y las mesas libres, que son las que puede abrir.
  const filterable = mode === "restaurant";
  const visible = filterable && scope === "mine" ? tiles.filter((tile) => tile.mine || tile.state === "free") : tiles;
  const noneMine = filterable && scope === "mine" && !tiles.some((tile) => tile.mine);

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
      {filterable && (
        <div role="group" aria-label={t("planScope")} className="flex gap-1 rounded-etiqueta border border-border bg-card p-1">
          {(["all", "mine"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                "min-h-10 flex-1 rounded-etiqueta px-3 text-sm font-semibold foco-etiqueta transition-colors",
                scope === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "all" ? t("scopeAll") : t("scopeMine")}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{t("loadError")}</p>}
      {loading && !tiles.length && <p className="text-sm text-muted-foreground">…</p>}
      {!loading && !error && !tiles.length && (
        <p className="text-sm text-muted-foreground">{mode === "restaurant" ? t("noTables") : t("noOrders")}</p>
      )}
      {noneMine && <p className="text-sm text-muted-foreground">{t("noMine")}</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
        {visible.map((tile) => (
          <TableTile
            key={tile.key}
            name={tile.name}
            state={tile.state}
            openedAt={tile.openedAt}
            total={tile.total}
            owner={tile.owner}
            mine={tile.mine}
            now={now}
            selected={isSelected(tile)}
            onClick={() => onPick(tile)}
          />
        ))}
        {!naming && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="foco-etiqueta flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-etiqueta border border-dashed border-border text-sm text-muted-foreground hover:bg-muted"
          >
            <Plus size={18} aria-hidden />
            {mode === "restaurant" ? t("newTakeout") : t("newOrder")}
          </button>
        )}
      </div>
      {naming && (
        <form onSubmit={submit} className="flex flex-col gap-2 rounded-etiqueta border border-border p-3">
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
