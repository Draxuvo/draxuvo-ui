"use client";
// La orden de la mesa elegida: renglones con + y −, nota, total fijo y las acciones que la API permite.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runningTotal, type Line } from "./lib";
import type { CurrentOrder } from "./use-order-source";

export function OrderPanel({
  current,
  loading,
  missing,
  canNote,
  sending,
  onQuantity,
  onRemove,
  onNote,
  onAddMore,
  onSend,
  onCharge,
}: {
  current: CurrentOrder | null;
  loading: boolean;
  missing: boolean;
  canNote: boolean;
  sending: boolean;
  onQuantity: (line: Line, quantity: number) => void;
  onRemove: (line: Line) => void;
  onNote: (line: Line, note: string) => void;
  /** En pantallas chicas lleva a la pestaña del menú. */
  onAddMore?: () => void;
  onSend: () => void;
  onCharge: () => void;
}) {
  const t = useTranslations("takeOrder");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const [noting, setNoting] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  if (!current) {
    return (
      <p className="text-sm text-muted-foreground">
        {loading ? "…" : missing ? t("orderGone") : t("pickTable")}
      </p>
    );
  }

  const live = current.lines.filter((l) => !l.cancelled);
  const draft = live.filter((l) => l.editable);
  const sent = live.filter((l) => !l.editable);
  const total = current.check || current.order ? current.total : runningTotal(live);

  function row(line: Line) {
    return (
      <li key={line.id} className="flex flex-col gap-1 border-b border-border py-2 last:border-0">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{line.name}</p>
            <p className="text-xs text-muted-foreground">
              {money.format(line.unit_price)} · {t("subtotal")} {money.format(line.unit_price * line.quantity)}
            </p>
          </div>
          {line.editable ? (
            <div className="flex items-center gap-1">
              <Button
                type="button" variant="outline" size="icon" className="size-11"
                aria-label={t("dec", { name: line.name })}
                onClick={() => onQuantity(line, line.quantity - 1)}
              >
                <Minus size={16} aria-hidden />
              </Button>
              <span className="w-7 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
              <Button
                type="button" variant="outline" size="icon" className="size-11"
                aria-label={t("inc", { name: line.name })}
                onClick={() => onQuantity(line, line.quantity + 1)}
              >
                <Plus size={16} aria-hidden />
              </Button>
              {canNote && (
                <Button
                  type="button" variant="ghost" size="icon" className="size-11"
                  aria-label={t("noteLabel", { name: line.name })}
                  onClick={() => { setNoting(noting === line.id ? null : line.id); setNoteText(line.note ?? ""); }}
                >
                  <StickyNote size={16} aria-hidden />
                </Button>
              )}
              <Button
                type="button" variant="ghost" size="icon" className="size-11 text-destructive"
                aria-label={t("remove", { name: line.name })}
                onClick={() => onRemove(line)}
              >
                <Trash2 size={16} aria-hidden />
              </Button>
            </div>
          ) : (
            <span className="text-sm font-bold tabular-nums">×{line.quantity}</span>
          )}
        </div>
        {line.note && noting !== line.id && <p className="text-xs italic text-muted-foreground">{line.note}</p>}
        {noting === line.id && (
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); onNote(line, noteText.trim()); setNoting(null); }}
          >
            <Input
              autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("notePlaceholder")} aria-label={t("noteLabel", { name: line.name })} className="h-11"
            />
            <Button type="submit" className="min-h-11">{t("noteSave")}</Button>
          </form>
        )}
      </li>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="mb-2 font-display text-xl font-extrabold">{current.title}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!live.length && <p className="py-3 text-sm text-muted-foreground">{t("orderEmpty")}</p>}
        {draft.length > 0 && (
          <section aria-label={t("draftSection")}>
            {sent.length > 0 && (
              <h3 className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("draftSection")}</h3>
            )}
            <ul>{draft.map(row)}</ul>
          </section>
        )}
        {sent.length > 0 && (
          <section aria-label={t("sentSection")} className="mt-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("sentSection")}</h3>
            <ul>{sent.map(row)}</ul>
          </section>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">{t("total")}</span>
          <span className="font-display text-2xl font-extrabold tabular-nums">{money.format(total)}</span>
        </div>
        <div className="flex gap-2">
          {onAddMore && current.canAdd && (
            <Button type="button" variant="outline" className="min-h-11 flex-1 lg:hidden" onClick={onAddMore}>
              {t("addMore")}
            </Button>
          )}
          {current.canSend && (
            <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={sending} onClick={onSend}>
              {sending ? t("sending") : t("send")}
            </Button>
          )}
          {current.canCharge && (
            <Button type="button" className="min-h-11 flex-1" onClick={onCharge}>
              {current.order && current.order.status !== "done" ? t("finishFirst") : t("charge")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
