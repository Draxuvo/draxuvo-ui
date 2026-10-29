// src/components/inventory/scan/count-screen.tsx
// Conteo físico (spec 034): se retoma el borrador más reciente (o se crea uno), se escanea, se revisa la diferencia
// y se confirma el ajuste. Todo lo capturado se guarda en el servidor.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStockCount, useStockCountActions, useStockCounts } from "@/hooks/use-stock-count";
import type { StockCountItem } from "@/types";
import { CountReview } from "./count-review";
import { ScanField } from "./scan-field";
import { Select } from "@/components/ui/select";

export function CountScreen() {
  const t = useTranslations("inventory.count");
  const locale = useLocale();
  const drafts = useStockCounts();
  const [chosen, setChosen] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [name, setName] = useState("");

  // Sin elegir otro, se abre el borrador más reciente.
  const id = chosen ?? drafts.data?.[0]?.id ?? null;
  const count = useStockCount(id);
  const actions = useStockCountActions(id);
  const items = count.data?.items ?? [];

  async function onScan(code: string) {
    const result = await actions.scan.mutateAsync({ code });
    if (!result) toast.error(t("notFound", { code }));
  }

  async function confirm() {
    await actions.confirm.mutateAsync();
    toast.success(t("confirmed"));
    setReviewing(false);
    setChosen(null);
  }

  async function discard() {
    if (!window.confirm(t("discardConfirm"))) return;
    await actions.discard.mutateAsync();
    toast.success(t("discarded"));
    setChosen(null);
    setReviewing(false);
  }

  async function create() {
    const created = await actions.create.mutateAsync(name.trim() || undefined);
    setChosen(created.id);
    setName("");
    setFocusSignal((n) => n + 1);
  }

  const header = (
    <header className="space-y-1">
      <Link href={`/${locale}/inventario`} className="foco-etiqueta inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:min-h-0">
        <ArrowLeft size={14} aria-hidden />
        {t("back")}
      </Link>
      <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
    </header>
  );

  if (drafts.isLoading) return <div className="mx-auto max-w-3xl space-y-5">{header}</div>;

  if (id === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        <div className="space-y-3 rounded-etiqueta border border-dashed border-border p-6">
          <p className="font-semibold text-foreground">{t("noDrafts")}</p>
          <p className="text-sm text-muted-foreground">{t("noDraftsHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("namePlaceholder")} aria-label={t("nameLabel")} className="max-w-xs" />
            <Button type="button" disabled={actions.create.isPending} onClick={() => void create()}>
              {t("start")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (reviewing) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        {header}
        <CountReview items={items} confirming={actions.confirm.isPending} onBack={() => setReviewing(false)} onConfirm={() => void confirm()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {drafts.data && drafts.data.length > 1 ? (
            <Select
              aria-label={t("draftPicker")}
              value={id}
              onChange={(event) => setChosen(Number(event.target.value))}
              className="w-auto"
            >
              {drafts.data.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {draft.name ?? t("draftName", { id: draft.id })}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm font-semibold text-foreground">{count.data?.name ?? t("draftName", { id })}</p>
          )}
          <Button type="button" variant="outline" size="sm" disabled={actions.create.isPending} onClick={() => void create()}>
            {t("newDraft")}
          </Button>
        </div>
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => void discard()}>
          {t("discard")}
        </Button>
      </div>

      <ScanField onScan={onScan} focusSignal={focusSignal} />

      {items.length === 0 ? (
        <p className="rounded-etiqueta border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card" aria-label={t("list")}>
          {items.map((item) => (
            <CountRow key={item.product.id} item={item} onSet={(qty) => actions.setItem.mutate({ productId: item.product.id, qty })} onRemove={() => actions.removeItem.mutate(item.product.id)} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-etiqueta border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("total", { count: items.length })}
        </p>
        <Button type="button" disabled={items.length === 0} onClick={() => setReviewing(true)}>
          {t("review")}
        </Button>
      </div>
    </div>
  );
}

function CountRow({ item, onSet, onRemove }: { item: StockCountItem; onSet: (qty: number) => void; onRemove: () => void }) {
  const t = useTranslations("inventory.count");
  const step = item.product.product_type?.fractional ? 0.001 : 1;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(item.counted_qty);

  function commit() {
    if (draft === null) return;
    const qty = Number(draft);
    setDraft(null);
    if (Number.isFinite(qty) && qty >= 0 && qty !== item.counted_qty) onSet(qty);
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{item.product.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{item.product.barcodes?.[0] ?? item.product.sku}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label={t("dec", { name: item.product.name })} onClick={() => onSet(Math.max(0, item.counted_qty - 1))}>
          <Minus size={14} aria-hidden />
        </Button>
        <Input
          type="number"
          min={0}
          step={step}
          value={shown}
          aria-label={t("qty", { name: item.product.name })}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && (event.currentTarget.blur(), event.preventDefault())}
          className="h-10 w-20 text-center tabular-nums"
        />
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label={t("inc", { name: item.product.name })} onClick={() => onSet(item.counted_qty + 1)}>
          <Plus size={14} aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive" aria-label={t("remove", { name: item.product.name })} onClick={onRemove}>
          <Trash2 size={14} aria-hidden />
        </Button>
      </div>
    </li>
  );
}
