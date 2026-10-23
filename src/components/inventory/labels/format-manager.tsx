// src/components/inventory/labels/format-manager.tsx
// Formatos propios de la empresa (spec 035): crear, editar y borrar. Los comunes no se tocan.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useLabelFormatMutations, useLabelFormats } from "@/hooks/use-label-formats";
import type { LabelFormat } from "@/types";
import { FormatForm } from "./format-form";

export function FormatManager({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("inventory.labels");
  const formats = useLabelFormats();
  const { remove } = useLabelFormatMutations();
  const [editing, setEditing] = useState<LabelFormat | "new" | null>(null);
  const own = (formats.data ?? []).filter((format) => format.custom);

  async function destroy(format: LabelFormat) {
    if (!window.confirm(t("deleteConfirm", { name: format.name }))) return;
    await remove.mutateAsync(format.id as number);
    toast.success(t("formatDeleted"));
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setEditing(null); }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle className="text-base">{t("formatsTitle")}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">{t("formatsHint")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {editing ? (
            <FormatForm key={editing === "new" ? "new" : editing.id} format={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          ) : (
            <>
              {own.length === 0 ? (
                <p className="rounded-etiqueta border border-dashed border-border p-4 text-sm text-muted-foreground">{t("noOwnFormats")}</p>
              ) : (
                <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card">
                  {own.map((format) => (
                    <li key={format.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{format.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("formatSummary", { w: format.label_width_mm, h: format.label_height_mm, count: format.labels_per_page })}
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={t("editFormatAria", { name: format.name })} onClick={() => setEditing(format)}>
                        <Pencil size={15} aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="size-10 hover:text-destructive" aria-label={t("deleteFormatAria", { name: format.name })} onClick={() => void destroy(format)}>
                        <Trash2 size={15} aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" className="min-h-11 w-full gap-1.5" onClick={() => setEditing("new")}>
                <Plus size={14} aria-hidden />
                {t("newFormat")}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
