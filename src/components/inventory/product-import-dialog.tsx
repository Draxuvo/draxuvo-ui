// src/components/inventory/product-import-dialog.tsx
"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inventoryService } from "@/services/inventory";
import { Upload, Download, FileSpreadsheet, X } from "lucide-react";

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPTED = [".xlsx", ".xls", ".csv"];

export function ProductImportDialog({ open, onOpenChange }: ProductImportDialogProps) {
  const t = useTranslations("inventory");
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

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

  const importMutation = useMutation({
    mutationFn: () => inventoryService.importFromFile(file!),
    onSuccess: (result) => {
      toast.success(t("importSuccess", { count: result.imported }));
      if (result.errors?.length) {
        result.errors.forEach((e) => toast.warning(e));
      }
      qc.invalidateQueries({ queryKey: ["products"] });
      handleClose();
    },
    onError: () => toast.error(t("importError")),
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("importTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download template */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t("importTemplateLabel")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("importTemplateHint")}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={downloadMutation.isPending}
              onClick={() => downloadMutation.mutate()}
            >
              <Download size={14} />
              {t("importDownload")}
            </Button>
          </div>

          {/* Drop zone */}
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <FileSpreadsheet size={20} className="text-estado-completada-foreground flex-shrink-0" />
              <p className="flex-1 text-sm text-foreground truncate">{file.name}</p>
              <button
                onClick={() => setFile(null)}
                className="text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
                dragging
                  ? "border-border bg-muted/50"
                  : "border-border hover:border-border hover:bg-muted/50"
              }`}
            >
              <Upload size={22} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                {t("importDropHint")}
              </p>
              <p className="text-xs text-muted-foreground">{ACCEPTED.join(", ")}</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!file || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? t("importing") : t("importConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
