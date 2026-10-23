// src/components/inventory/labels/label-preview.tsx
// Vista previa (spec 035): es el mismo PDF que se descarga, así que lo que se ve es lo que se imprime. Muestra además el
// resumen y los avisos de cada producto antes de descargar.
"use client";
import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { inventoryService } from "@/services/inventory";
import { useAuthStore } from "@/store/auth";
import type { LabelOptions } from "@/types";

interface LabelPreviewProps {
  /** `null` cuando todavía no se puede armar (sin productos, falta algún código o se pasa del máximo). */
  options: LabelOptions | null;
  names: Record<number, string>;
}

export function LabelPreview({ options, names }: LabelPreviewProps) {
  const t = useTranslations("inventory.labels");
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const settled = useDebouncedValue(options, 500);

  const preview = useQuery({
    queryKey: ["label-preview", companyId, JSON.stringify(settled)],
    enabled: !!settled,
    retry: false,
    staleTime: Infinity,
    gcTime: 30_000,
    queryFn: async () => {
      const checked = await inventoryService.labels.check(settled as LabelOptions);
      if (checked.error) return { error: checked.error };
      return { check: checked.check, blob: await inventoryService.labels.pdf(settled as LabelOptions) };
    },
  });

  const data = preview.data;
  const blob = data && "blob" in data ? data.blob : null;
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!options) return <p className="rounded-etiqueta border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("previewWaiting")}</p>;
  if (preview.isLoading || options !== settled) return <p role="status" className="p-6 text-center text-sm text-muted-foreground">{t("previewLoading")}</p>;
  if (preview.isError) return <p role="alert" className="p-6 text-center text-sm text-destructive">{t("previewError")}</p>;
  if (data && "error" in data && data.error) {
    return <p role="alert" className="rounded-etiqueta bg-estado-pendiente px-3 py-2 text-sm text-estado-pendiente-foreground">{data.error.message}</p>;
  }
  if (!data || !("check" in data) || !data.check) return null;

  const { check } = data;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground" aria-live="polite">
        {t("summary", { count: check.labels_count, pages: check.pages })}
      </p>

      {check.warnings.length > 0 && (
        <ul role="alert" aria-label={t("warnings")} className="space-y-1 rounded-etiqueta bg-estado-pendiente px-3 py-2 text-sm text-estado-pendiente-foreground">
          {check.warnings.map((warning) => (
            <li key={`${warning.product_id}-${warning.code}`} className="flex items-start gap-2">
              <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>{t("warningFor", { name: names[warning.product_id] ?? `#${warning.product_id}`, message: warning.message })}</span>
            </li>
          ))}
        </ul>
      )}
      {check.skipped.length > 0 && <p className="text-xs text-muted-foreground">{t("skipped", { count: check.skipped.length })}</p>}

      {url && (
        <>
          <iframe title={t("previewTitle")} src={url} className="h-[28rem] w-full rounded-etiqueta border border-border bg-muted" />
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <a href={url} download="etiquetas.pdf">
                <Download size={15} aria-hidden className="mr-1.5" />
                {t("download")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={url} target="_blank" rel="noopener">
                <ExternalLink size={15} aria-hidden className="mr-1.5" />
                {t("openPdf")}
              </a>
            </Button>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">{t("printTip")}</p>
    </div>
  );
}
