// src/components/inventory/scan/count-review.tsx
// Revisión del conteo (spec 034): lo contado contra el stock del sistema, con la diferencia en texto y color, y
// confirmación explícita antes de ajustar.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StockCountItem } from "@/types";

interface CountReviewProps {
  items: StockCountItem[];
  confirming: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export function CountReview({ items, confirming, onBack, onConfirm }: CountReviewProps) {
  const t = useTranslations("inventory.count");
  const [asking, setAsking] = useState(false);
  const withDifference = items.filter((item) => item.difference !== 0);
  const anyChanged = items.some((item) => item.changed);

  return (
    <section aria-label={t("reviewTitle")} className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-extrabold">{t("reviewTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("reviewSummary", { diff: withDifference.length, same: items.length - withDifference.length })}</p>
      </div>

      {anyChanged && (
        <p role="status" className="flex items-start gap-2 rounded-etiqueta bg-estado-pendiente px-3 py-2 text-sm text-estado-pendiente-foreground">
          <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
          {t("changedWarning")}
        </p>
      )}

      <div className="overflow-x-auto rounded-etiqueta border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">{t("colProduct")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colSystem")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("colCounted")}</th>
              <th className="px-4 py-2 text-right font-semibold">{t("colDifference")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.product.id} className={cn(item.difference === 0 && "text-muted-foreground")}>
                <td className="px-4 py-2">
                  <span className="font-medium text-foreground">{item.product.name}</span>
                  {item.changed && <span className="ml-2 rounded-full bg-estado-pendiente px-2 py-0.5 text-xs font-semibold text-estado-pendiente-foreground">{t("changedBadge")}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{item.current_stock}</td>
                <td className="px-3 py-2 text-right tabular-nums">{item.counted_qty}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  <span
                    className={cn(
                      item.difference > 0 && "text-sello",
                      item.difference < 0 && "text-destructive",
                    )}
                  >
                    {item.difference === 0 ? t("noDifference") : item.difference > 0 ? t("surplus", { qty: item.difference }) : t("shortage", { qty: Math.abs(item.difference) })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={confirming}>
          {t("keepCounting")}
        </Button>
        <Button type="button" onClick={() => setAsking(true)} disabled={confirming || items.length === 0}>
          {confirming ? t("confirming") : t("confirm")}
        </Button>
      </div>

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>{t("confirmBody", { count: withDifference.length })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAsking(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAsking(false);
                onConfirm();
              }}
            >
              {t("confirmAdjust")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
