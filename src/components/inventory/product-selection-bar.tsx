// src/components/inventory/product-selection-bar.tsx
// Barra de acciones sobre los productos marcados en el inventario (spec 035): solo aparece con selección.
"use client";
import { useTranslations } from "next-intl";
import { Barcode, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductSelectionBarProps {
  count: number;
  onGenerate: () => void;
  onPrint: () => void;
  onClear: () => void;
}

export function ProductSelectionBar({ count, onGenerate, onPrint, onClear }: ProductSelectionBarProps) {
  const t = useTranslations("inventory.labels");
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label={t("selectionBar")}
      className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-etiqueta border border-border bg-card px-4 py-2.5 shadow-etiqueta"
    >
      <p className="text-sm font-semibold text-foreground" aria-live="polite">
        {t("selected", { count })}
      </p>
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onGenerate}>
        <Barcode size={14} aria-hidden />
        {t("generateCodes")}
      </Button>
      <Button type="button" size="sm" className="gap-1.5" onClick={onPrint}>
        <Printer size={14} aria-hidden />
        {t("printLabels")}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={onClear}>
        <X size={14} aria-hidden />
        {t("clearSelection")}
      </Button>
    </div>
  );
}
