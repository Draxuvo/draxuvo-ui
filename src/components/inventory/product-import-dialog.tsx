// src/components/inventory/product-import-dialog.tsx
// Importación de productos desde Excel (spec 034): la carga corre en segundo plano; el diálogo muestra el avance,
// el resumen final con las filas con error y las importaciones recientes.
"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inventoryService } from "@/services/inventory";
import { useProductImport } from "@/hooks/use-product-import";
import { Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ProductImport } from "@/types";

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPTED = [".xlsx", ".xls", ".csv"];

export function ProductImportDialog({ open, onOpenChange }: ProductImportDialogProps) {
  const t = useTranslations("inventory");
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const imports = useProductImport(open);
  const { current } = imports;

  const downloadMutation = useMutation({
    mutationFn: () => inventoryService.downloadTemplate(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla_productos.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error(t("templateError")),
  });

  function handleClose() {
    setFile(null);
    onOpenChange(false);
  }

  function pickFile(picked: File | null | undefined) {
    if (!picked) return;
    const ext = picked.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error(t("importInvalidFile"));
      return;
    }
    setFile(picked);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  }

  const showPicker = !current && !imports.loading;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("importTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {showPicker && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("importTemplateLabel")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("importTemplateHint")}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={downloadMutation.isPending} onClick={() => downloadMutation.mutate()}>
                  <Download size={14} />
                  {t("importDownload")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("importTextHint")}</p>

              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <FileSpreadsheet size={20} className="flex-shrink-0 text-estado-completada-foreground" />
                  <p className="flex-1 truncate text-sm text-foreground">{file.name}</p>
                  <button onClick={() => setFile(null)} aria-label={t("cancel")} className="text-muted-foreground transition-colors hover:text-foreground">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 transition-colors ${
                    dragging ? "border-foreground/40 bg-muted/50" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Upload size={22} className="text-muted-foreground" />
                  <p className="text-center text-sm text-muted-foreground">{t("importDropHint")}</p>
                  <p className="text-xs text-muted-foreground">{ACCEPTED.join(", ")}</p>
                  <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                </div>
              )}

              {imports.recent.length > 0 && (
                <section aria-label={t("importRecent")} className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("importRecent")}</h3>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {imports.recent.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => imports.open(item.id)}
                          aria-label={t("importOpen", { name: item.filename ?? `#${item.id}` })}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          <span className="min-w-0 truncate">{item.filename ?? `#${item.id}`}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t("importSummary", { created: item.created, updated: item.updated, unchanged: item.unchanged, errors: item.errors_total })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {imports.loading && !current && <p className="text-sm text-muted-foreground">{t("importStart")}</p>}
          {current && <ImportStatus item={current} />}
        </div>

        <DialogFooter>
          {current && !imports.running ? (
            <>
              <Button variant="outline" onClick={() => { setFile(null); imports.reset(); }}>
                {t("importAnother")}
              </Button>
              <Button onClick={handleClose}>{t("importClose")}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                {current ? t("importClose") : t("cancel")}
              </Button>
              {!current && (
                <Button disabled={!file || imports.starting} onClick={() => file && imports.start(file)}>
                  {imports.starting ? t("importing") : t("importConfirm")}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportStatus({ item }: { item: ProductImport }) {
  const t = useTranslations("inventory");
  const running = item.status === "queued" || item.status === "processing";
  const percent = item.total_rows > 0 ? Math.min(100, Math.round((item.processed_rows / item.total_rows) * 100)) : 0;

  if (running) {
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="text-sm font-medium text-foreground">
          {item.status === "queued" ? t("importQueued") : t("importRunning", { done: item.processed_rows, total: item.total_rows })}
        </p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{t("importRunningHint")}</p>
      </div>
    );
  }

  const failed = item.status === "failed";
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {failed ? <AlertTriangle size={16} className="text-destructive" aria-hidden /> : <CheckCircle2 size={16} className="text-sello" aria-hidden />}
        {failed ? t("importFailed") : t("importDone")}
        {item.filename && <span className="truncate font-normal text-muted-foreground">· {item.filename}</span>}
      </p>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          [t("importCreated"), item.created],
          [t("importUpdated"), item.updated],
          [t("importUnchanged"), item.unchanged],
          [t("importErrors"), item.errors_total],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-border bg-card px-2 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-display text-xl font-extrabold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {item.errors.length > 0 && (
        <section aria-label={t("importErrorsTitle")} className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("importErrorsTitle")}</h3>
          <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
            {item.errors.map((error, index) => (
              <li key={`${error.row}-${index}`} className="px-3 py-1.5">
                <span className="font-medium tabular-nums">{error.row != null ? t("importErrorRow", { row: error.row }) : "—"}</span>
                {error.sku && <span className="ml-2 font-mono text-xs text-muted-foreground">{error.sku}</span>}
                <span className="block text-xs text-destructive">{error.error}</span>
              </li>
            ))}
          </ul>
          {item.errors_total > item.errors.length && (
            <p className="text-xs text-muted-foreground">{t("importErrorsMore", { shown: item.errors.length, total: item.errors_total })}</p>
          )}
        </section>
      )}
    </div>
  );
}
