// src/components/inventory/labels/labels-screen.tsx
// Imprimir etiquetas (spec 035): productos con copias, formato de papel, casillas de Nombre y Precio, posición de inicio y
// vista previa con descarga. Los productos llegan del inventario o de Recibir mercancía por `sessionStorage`.
"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Barcode, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readLabelSelection } from "@/hooks/use-label-selection";
import { useLabelFormats } from "@/hooks/use-label-formats";
import { inventoryService } from "@/services/inventory";
import type { LabelFormat, LabelOptions } from "@/types";
import { FormatManager } from "./format-manager";
import { FormatPicker } from "./format-picker";
import { LabelLines, MAX_COPIES, type LabelLine } from "./label-lines";
import { LabelPreview } from "./label-preview";

/** Máximo de etiquetas por PDF (la API también lo valida). */
export const MAX_LABELS = 1000;

const subscribe = () => () => {};

/** Verdadero solo en el navegador: `sessionStorage` no existe al renderizar en el servidor. */
function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function LabelsScreen() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <LabelsBoard initial={readLabelSelection().map((item) => ({ ...item, code: null }))} />;
}

function LabelsBoard({ initial }: { initial: LabelLine[] }) {
  const t = useTranslations("inventory.labels");
  const locale = useLocale();
  const formats = useLabelFormats();
  const [lines, setLines] = useState<LabelLine[]>(initial);
  const [formatId, setFormatId] = useState<string | number | null>(null);
  // Nombre y Precio: `null` = el valor por defecto del formato (apagados en etiquetas chicas).
  const [showName, setShowName] = useState<boolean | null>(null);
  const [showPrice, setShowPrice] = useState<boolean | null>(null);
  const [start, setStart] = useState(1);
  const [managing, setManaging] = useState(false);
  const [capped, setCapped] = useState(false);

  const list = formats.data ?? [];
  const format: LabelFormat | undefined = list.find((f) => f.id === formatId) ?? list[0];
  const nameOn = showName ?? !format?.small;
  const priceOn = showPrice ?? !format?.small;
  const total = lines.reduce((sum, line) => sum + line.copies, 0);
  const missing = lines.filter((line) => line.barcodes.length === 0);
  const sheet = format?.kind === "sheet";

  const generate = useMutation({
    mutationFn: () => inventoryService.generateProductBarcodes(missing.map((line) => line.id)),
    onSuccess: (result) => {
      setLines((current) =>
        current.map((line) => result.products.find((p) => p.id === line.id) ? { ...line, barcodes: result.products.find((p) => p.id === line.id)!.barcodes ?? [] } : line),
      );
      toast.success(t("generatedToast", { count: result.generated }));
    },
  });

  const update = (id: number, patch: Partial<LabelLine>) => setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));

  // Una etiqueta por unidad en existencia (los que no se cuentan o sin existencia, una); proporcional si pasa del máximo.
  function perUnit() {
    const wanted = lines.map((line) => (line.stock != null && line.stock > 0 ? Math.ceil(line.stock) : 1));
    const sum = wanted.reduce((a, b) => a + b, 0);
    const scale = sum > MAX_LABELS ? MAX_LABELS / sum : 1;
    setCapped(sum > MAX_LABELS);
    setLines((current) => current.map((line, index) => ({ ...line, copies: Math.min(MAX_COPIES, Math.max(1, Math.floor(wanted[index] * scale))) })));
  }

  const options: LabelOptions | null =
    format && lines.length > 0 && missing.length === 0 && total <= MAX_LABELS
      ? {
          format_id: format.id,
          show_name: nameOn,
          show_price: priceOn,
          start_position: sheet ? Math.min(Math.max(1, start), format.labels_per_page) : 1,
          items: lines.map((line) => ({ product_id: line.id, copies: line.copies, ...(line.code ? { code: line.code } : {}) })),
        }
      : null;

  const header = (
    <header className="space-y-1">
      <Link href={`/${locale}/inventario`} className="foco-etiqueta inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} aria-hidden />
        {t("back")}
      </Link>
      <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
    </header>
  );

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        {header}
        <div className="space-y-3 rounded-etiqueta border border-dashed border-border p-6">
          <p className="font-semibold text-foreground">{t("emptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
          <Button asChild>
            <Link href={`/${locale}/inventario`}>{t("goInventory")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {header}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold" aria-live="polite">
              {t("total", { count: total })}
            </p>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={perUnit}>
              <Layers size={14} aria-hidden />
              {t("perUnit")}
            </Button>
          </div>
          {capped && <p role="status" className="text-xs text-muted-foreground">{t("perUnitCapped", { max: MAX_LABELS })}</p>}
          {total > MAX_LABELS && <p role="alert" className="text-sm text-destructive">{t("tooMany", { max: MAX_LABELS })}</p>}

          {missing.length > 0 && (
            <div role="alert" className="space-y-2 rounded-etiqueta bg-estado-pendiente px-3 py-2 text-sm text-estado-pendiente-foreground">
              <p>{t("noCode", { count: missing.length, names: missing.map((line) => line.name).join(", ") })}</p>
              <Button type="button" size="sm" className="gap-1.5" disabled={generate.isPending} onClick={() => generate.mutate()}>
                <Barcode size={14} aria-hidden />
                {generate.isPending ? t("generating") : t("generateMissing")}
              </Button>
            </div>
          )}

          <LabelLines
            lines={lines}
            onCopies={(id, copies) => update(id, { copies })}
            onCode={(id, code) => update(id, { code })}
            onRemove={(id) => setLines((current) => current.filter((line) => line.id !== id))}
          />
        </div>

        <div className="space-y-4">
          <section className="space-y-3 rounded-etiqueta border border-border bg-card p-4" aria-label={t("options")}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{t("format")}</span>
                <button type="button" onClick={() => setManaging(true)} className="foco-etiqueta text-xs font-semibold text-primary hover:underline">
                  {t("manageFormats")}
                </button>
              </div>
              {format ? (
                <FormatPicker
                  formats={list}
                  value={format.id}
                  onChange={(picked) => {
                    setFormatId(picked.id);
                    setShowName(null);
                    setShowPrice(null);
                    setStart(1);
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("formatsLoading")}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={nameOn} onChange={(e) => setShowName(e.target.checked)} className="size-4 accent-primary" />
                {t("showName")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={priceOn} onChange={(e) => setShowPrice(e.target.checked)} className="size-4 accent-primary" />
                {t("showPrice")}
              </label>
            </div>
            {format?.small && <p className="text-xs text-muted-foreground">{t("smallHint")}</p>}

            {sheet && format && (
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span>{t("startAt")}</span>
                <Input
                  type="number"
                  min={1}
                  max={format.labels_per_page}
                  step={1}
                  value={start}
                  onChange={(e) => setStart(Math.min(format.labels_per_page, Math.max(1, Math.floor(Number(e.target.value)) || 1)))}
                  className="h-9 w-20 text-center tabular-nums"
                  aria-label={t("startAt")}
                />
                <span className="text-xs text-muted-foreground">{t("startHint", { max: format.labels_per_page })}</span>
              </label>
            )}
          </section>

          <LabelPreview options={options} names={Object.fromEntries(lines.map((line) => [line.id, line.name]))} />
        </div>
      </div>

      <FormatManager open={managing} onOpenChange={setManaging} />
    </div>
  );
}
