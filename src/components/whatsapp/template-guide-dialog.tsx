// src/components/whatsapp/template-guide-dialog.tsx
// Guía copiable para crear cada plantilla en Meta (spec 047): Draxuvo solo lee y verifica plantillas, no las crea.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useGuide } from "@/hooks/use-whatsapp";
import type { WhatsappGuideItem, WhatsappKind } from "@/types";

function CopyField({ id, label, value, multiline = false }: { id: string; label: string; value: string; multiline?: boolean }) {
  const t = useTranslations("whatsapp.guide");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t("copied", { label }));
    } catch {
      // Sin permiso de portapapeles el texto sigue visible para copiarlo a mano.
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span id={id} className="text-xs text-muted-foreground">
          {label}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={t("copy", { label })} className="gap-1.5">
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? t("copiedShort") : t("copyShort")}
        </Button>
      </div>
      <p
        aria-labelledby={id}
        className={`rounded-etiqueta border border-border bg-muted px-3 py-2 text-sm text-foreground ${multiline ? "whitespace-pre-wrap" : "break-all"}`}
      >
        {value}
      </p>
    </div>
  );
}

function GuideItem({ item }: { item: WhatsappGuideItem }) {
  const t = useTranslations("whatsapp");
  return (
    <section aria-labelledby={`guide-${item.kind}`} className="space-y-3 rounded-etiqueta border border-border bg-card p-4">
      <h3 id={`guide-${item.kind}`} className="font-display text-lg font-semibold">
        {t(`types.${item.kind}.label`)}
      </h3>
      <CopyField id={`guide-${item.kind}-name`} label={t("guide.name")} value={item.name} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CopyField id={`guide-${item.kind}-language`} label={t("guide.language")} value={item.language} />
        <CopyField id={`guide-${item.kind}-category`} label={t("guide.category")} value={item.category} />
      </div>
      <CopyField id={`guide-${item.kind}-body`} label={t("guide.body")} value={item.body} multiline />
      <div>
        <p className="text-xs text-muted-foreground">{t("guide.variables")}</p>
        <ol className="mt-1 space-y-0.5 text-sm text-foreground">
          {item.variables.map((variable) => (
            <li key={variable.position}>
              <span className="font-medium">{`{{${variable.position}}}`}</span> — {variable.meaning}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** `kind` abre la guía de un solo tipo; sin él muestra todas. */
export function TemplateGuideDialog({ open, onOpenChange, kind }: { open: boolean; onOpenChange: (open: boolean) => void; kind?: WhatsappKind }) {
  const t = useTranslations("whatsapp.guide");
  const { data, isLoading, isError } = useGuide();
  const items = (data ?? []).filter((item) => !kind || item.kind === kind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {isLoading && <Skeleton className="h-48 w-full" aria-busy="true" />}
        {isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("error")}
          </p>
        )}
        <div className="space-y-4">
          {items.map((item) => (
            <GuideItem key={item.kind} item={item} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
