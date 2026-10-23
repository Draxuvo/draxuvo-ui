// src/components/inventory/generate-barcodes-dialog.tsx
// Códigos propios en lote (spec 035): confirma sobre la selección y muestra el resumen (generados, ya tenían, fallidos).
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inventoryService } from "@/services/inventory";
import type { GenerateBarcodesResult, Product } from "@/types";

interface GenerateBarcodesDialogProps {
  open: boolean;
  products: Product[];
  onOpenChange: (open: boolean) => void;
}

export function GenerateBarcodesDialog({ open, products, onOpenChange }: GenerateBarcodesDialogProps) {
  const t = useTranslations("inventory.labels");
  const qc = useQueryClient();
  const [result, setResult] = useState<GenerateBarcodesResult | null>(null);
  const withoutCode = products.filter((product) => !product.barcodes?.length).length;

  // Al cerrar se olvida el resumen para que la próxima vez empiece de cero.
  function handleOpenChange(next: boolean) {
    if (!next) setResult(null);
    onOpenChange(next);
  }

  const run = useMutation({
    mutationFn: () => inventoryService.generateProductBarcodes(products.map((product) => product.id)),
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("generateTitle")}</DialogTitle>
          <DialogDescription>
            {result ? t("generateDone") : t("generateBody", { total: products.length, without: withoutCode })}
          </DialogDescription>
        </DialogHeader>

        {result && (
          <dl className="grid grid-cols-3 gap-2 text-center" aria-label={t("generateSummary")}>
            {[
              [t("summaryGenerated"), result.generated],
              [t("summaryAlreadyHad"), result.already_had],
              [t("summaryFailed"), result.failed.length],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-border bg-card px-2 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-display text-xl font-extrabold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {result && result.failed.length > 0 && (
          <p role="alert" className="text-xs text-destructive">
            {t("failedNote", { count: result.failed.length })}
          </p>
        )}

        <DialogFooter className="gap-2">
          {result ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              {t("close")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="button" disabled={withoutCode === 0 || run.isPending} onClick={() => run.mutate()}>
                {run.isPending ? t("generating") : t("generateConfirm", { count: withoutCode })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
