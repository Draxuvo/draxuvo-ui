// src/components/inventory/labels/format-form.tsx
// Alta y edición de un formato propio (spec 035): nombre y medidas en milímetros. La API valida que la cuadrícula
// quepa en la página y devuelve el motivo.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLabelFormatMutations } from "@/hooks/use-label-formats";
import type { LabelFormat, LabelFormatKind, LabelFormatPayload } from "@/types";

type Values = Record<Exclude<keyof LabelFormatPayload, "name" | "kind">, string> & { name: string; kind: LabelFormatKind };

const NUMBER_FIELDS = [
  "page_width_mm", "page_height_mm", "columns", "rows", "label_width_mm", "label_height_mm",
  "margin_top_mm", "margin_left_mm", "gap_x_mm", "gap_y_mm",
] as const;
const SHEET_ONLY = new Set(["columns", "rows", "margin_top_mm", "margin_left_mm", "gap_x_mm", "gap_y_mm"]);

function initial(format: LabelFormat | null): Values {
  return {
    name: format?.name ?? "",
    kind: format?.kind ?? "sheet",
    page_width_mm: String(format?.page_width_mm ?? 210),
    page_height_mm: String(format?.page_height_mm ?? 297),
    columns: String(format?.columns ?? 3),
    rows: String(format?.rows ?? 8),
    label_width_mm: String(format?.label_width_mm ?? 63.5),
    label_height_mm: String(format?.label_height_mm ?? 33.9),
    margin_top_mm: String(format?.margin_top_mm ?? 13),
    margin_left_mm: String(format?.margin_left_mm ?? 7.2),
    gap_x_mm: String(format?.gap_x_mm ?? 2.5),
    gap_y_mm: String(format?.gap_y_mm ?? 0),
  };
}

export function FormatForm({ format, onDone }: { format: LabelFormat | null; onDone: () => void }) {
  const t = useTranslations("inventory.labels");
  const { create, update } = useLabelFormatMutations();
  const [values, setValues] = useState<Values>(() => initial(format));
  const [error, setError] = useState<string | null>(null);
  const roll = values.kind === "roll";
  const pending = create.isPending || update.isPending;

  const set = (key: keyof Values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  // En un rollo la página es la etiqueta: se copian las medidas y se ignoran cuadrícula, márgenes y separación.
  function payload(): LabelFormatPayload {
    const num = (key: (typeof NUMBER_FIELDS)[number]) => Number(values[key]);
    if (roll) {
      return {
        name: values.name.trim(), kind: "roll", page_width_mm: num("label_width_mm"), page_height_mm: num("label_height_mm"),
        columns: 1, rows: 1, label_width_mm: num("label_width_mm"), label_height_mm: num("label_height_mm"),
        margin_top_mm: 0, margin_left_mm: 0, gap_x_mm: 0, gap_y_mm: 0,
      };
    }
    return {
      name: values.name.trim(), kind: "sheet", page_width_mm: num("page_width_mm"), page_height_mm: num("page_height_mm"),
      columns: num("columns"), rows: num("rows"), label_width_mm: num("label_width_mm"), label_height_mm: num("label_height_mm"),
      margin_top_mm: num("margin_top_mm"), margin_left_mm: num("margin_left_mm"), gap_x_mm: num("gap_x_mm"), gap_y_mm: num("gap_y_mm"),
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) return setError(t("nameRequired"));
    setError(null);
    try {
      if (format) await update.mutateAsync({ id: format.id as number, data: payload() });
      else await create.mutateAsync(payload());
      toast.success(t("formatSaved"));
      onDone();
    } catch (failure) {
      // La API explica por qué no caben las medidas; se muestra bajo el formulario.
      if (isAxiosError(failure)) setError(failure.response?.data?.error?.message ?? t("formatError"));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label={format ? t("editFormat") : t("newFormat")}>
      <div className="space-y-1.5">
        <Label htmlFor="format-name" className="text-xs font-medium text-foreground">{t("formatName")}</Label>
        <Input id="format-name" value={values.name} maxLength={60} placeholder={t("formatNamePlaceholder")} onChange={(e) => set("name", e.target.value)} />
      </div>

      <div role="radiogroup" aria-label={t("formatKind")} className="grid grid-cols-2 gap-2">
        {(["sheet", "roll"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={values.kind === kind}
            onClick={() => set("kind", kind)}
            className={`min-h-10 rounded-etiqueta border px-3 text-sm font-semibold foco-etiqueta ${values.kind === kind ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {t(`kind.${kind}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {NUMBER_FIELDS.filter((key) => !(roll && (SHEET_ONLY.has(key) || key.startsWith("page_")))).map((key) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`format-${key}`} className="text-xs font-medium text-foreground">{t(`field.${key}`)}</Label>
            <Input
              id={`format-${key}`}
              type="number"
              inputMode="decimal"
              min={0}
              step={key === "columns" || key === "rows" ? 1 : 0.1}
              value={values[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{roll ? t("rollHint") : t("sheetHint")}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" disabled={pending}>{pending ? t("saving") : t("save")}</Button>
      </div>
    </form>
  );
}
