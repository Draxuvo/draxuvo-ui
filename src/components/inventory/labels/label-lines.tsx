// src/components/inventory/labels/label-lines.tsx
// Productos por etiquetar (spec 035): copias, código que se imprime cuando hay varios y quitar renglón.
"use client";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LabelSelectionItem } from "@/hooks/use-label-selection";
import { Select } from "@/components/ui/select";

export const MAX_COPIES = 1000;

/** Un renglón: el producto, las copias y el código elegido (`null` = el primero del producto). */
export type LabelLine = LabelSelectionItem & { code: string | null };

interface LabelLinesProps {
  lines: LabelLine[];
  onCopies: (id: number, copies: number) => void;
  onCode: (id: number, code: string) => void;
  onRemove: (id: number) => void;
}

export function LabelLines({ lines, onCopies, onCode, onRemove }: LabelLinesProps) {
  const t = useTranslations("inventory.labels");
  return (
    <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card" aria-label={t("list")}>
      {lines.map((line) => (
        <li key={line.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 basis-48">
            <p className="truncate font-medium text-foreground">{line.name}</p>
            {line.barcodes.length === 0 ? (
              <p className="text-xs font-semibold text-destructive">{t("noCodeBadge")}</p>
            ) : line.barcodes.length === 1 ? (
              <p className="font-mono text-xs text-muted-foreground">{line.barcodes[0]}</p>
            ) : (
              <Select
                aria-label={t("codeOf", { name: line.name })}
                value={line.code ?? line.barcodes[0]}
                onChange={(event) => onCode(line.id, event.target.value)}
                className="mt-0.5 w-auto max-w-full" selectClassName="font-mono text-xs"
              >
                {line.barcodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only sm:not-sr-only">{t("copies")}</span>
            <Input
              type="number"
              min={1}
              max={MAX_COPIES}
              step={1}
              value={line.copies}
              aria-label={t("copiesOf", { name: line.name })}
              onChange={(event) => {
                const value = Math.floor(Number(event.target.value));
                onCopies(line.id, Number.isFinite(value) ? Math.min(MAX_COPIES, Math.max(1, value)) : 1);
              }}
              className="h-10 w-24 text-center tabular-nums"
            />
          </label>
          <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive" aria-label={t("removeLine", { name: line.name })} onClick={() => onRemove(line.id)}>
            <Trash2 size={14} aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}
