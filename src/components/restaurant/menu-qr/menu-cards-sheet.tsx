// src/components/restaurant/menu-qr/menu-cards-sheet.tsx
"use client";
// Tarjetas QR de las mesas (spec 059): enlaces públicos del menú, regenerar uno y PDF para imprimir (4 por hoja carta).
// Solo dueño y administrador (la pestaña Configuración ya es solo suya; la API también lo exige).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMenuLinks, useRegenerateMenuLink } from "@/hooks/use-restaurant";
import { restaurantService } from "@/services/restaurant";
import type { MenuLink } from "@/types";

interface MenuCardsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MenuCardsSheet({ open, onOpenChange }: MenuCardsSheetProps) {
  const t = useTranslations("restaurant.menuQr");
  const links = useMenuLinks({ enabled: open });
  const regenerate = useRegenerateMenuLink();
  // Todas marcadas por omisión: se guardan las que se desmarcan, así una mesa nueva llega marcada.
  const [unselected, setUnselected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState<MenuLink | null>(null);
  const [downloading, setDownloading] = useState(false);

  const rows = links.data ?? [];
  const selected = rows.filter((row) => !unselected.has(row.table_id));
  const allSelected = selected.length === rows.length;

  function toggle(tableId: number) {
    setUnselected((current) => {
      const next = new Set(current);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }

  async function copy(link: MenuLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success(t("copied"));
    } catch {
      // Sin permiso de portapapeles el enlace sigue a la vista para abrirlo o copiarlo a mano.
    }
  }

  async function download() {
    if (selected.length === 0) return;
    setDownloading(true);
    try {
      const blob = await restaurantService.menuCardsPdf(allSelected ? undefined : selected.map((row) => row.table_id));
      saveBlob(blob, "tarjetas-qr.pdf");
    } catch {
      // El mensaje de la API ya salió en el aviso global.
    } finally {
      setDownloading(false);
    }
  }

  async function confirmRegenerate() {
    if (!confirming) return;
    try {
      await regenerate.mutateAsync(confirming.table_id);
      toast.success(t("regenerated"));
    } catch {
      // El mensaje de la API ya salió en el aviso global.
    } finally {
      setConfirming(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border/60 px-6 py-5">
            <SheetTitle className="text-base">{t("title")}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {links.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((n) => (
                  <Skeleton key={n} className="h-14 w-full" />
                ))}
              </div>
            ) : links.isError ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">{t("error")}</p>
                <Button variant="outline" onClick={() => void links.refetch()}>
                  {t("retry")}
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground" aria-live="polite">
                    {t("selected", { count: selected.length })}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setUnselected(new Set())}>
                      {t("selectAll")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setUnselected(new Set(rows.map((r) => r.table_id)))}>
                      {t("selectNone")}
                    </Button>
                  </div>
                </div>
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <li key={row.table_id} className="flex items-center gap-3 rounded-etiqueta border border-border bg-card p-3">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={!unselected.has(row.table_id)}
                        onChange={() => toggle(row.table_id)}
                        aria-label={t("select", { name: row.name })}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">{row.name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{row.url}</p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Button variant="ghost" size="icon" aria-label={`${t("copy")}: ${row.name}`} onClick={() => void copy(row)}>
                          <Copy size={16} aria-hidden />
                        </Button>
                        <Button asChild variant="ghost" size="icon">
                          <a href={row.url} target="_blank" rel="noopener noreferrer" aria-label={`${t("open")}: ${row.name}`}>
                            <ExternalLink size={16} aria-hidden />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`${t("regenerate")}: ${row.name}`} onClick={() => setConfirming(row)}>
                          <RefreshCw size={16} aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <SheetFooter className="border-t border-border/60 px-6 py-4">
            <Button onClick={() => void download()} disabled={selected.length === 0 || downloading} className="gap-2">
              <Download size={16} aria-hidden />
              {downloading ? t("downloading") : t("download")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!confirming} onOpenChange={(value) => !value && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("regenerateTitle", { name: confirming?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("regenerateBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void confirmRegenerate()} disabled={regenerate.isPending}>
              {t("regenerateConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
