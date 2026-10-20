// src/components/terminals/terminal-list.tsx — terminales de la empresa con su proveedor, estado y cobros.
// Con cobros no se borra (FR-019): la pantalla ofrece desactivarla.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteTerminal, useUpdateTerminal } from "@/hooks/use-payment-terminals";
import { cn } from "@/lib/utils";
import type { PaymentTerminal } from "@/types";

export function TerminalList({ terminals, onEdit }: { terminals: PaymentTerminal[]; onEdit: (terminal: PaymentTerminal) => void }) {
  const t = useTranslations("terminals");
  const update = useUpdateTerminal();
  const remove = useDeleteTerminal();
  const [confirming, setConfirming] = useState<PaymentTerminal | null>(null);
  const inUse = (confirming?.payments_count ?? 0) > 0;

  async function setActive(terminal: PaymentTerminal, active: boolean) {
    try {
      await update.mutateAsync({ id: terminal.id, data: { active } });
      toast.success(active ? t("activated", { name: terminal.name }) : t("deactivated", { name: terminal.name }));
      setConfirming(null);
    } catch {
      // El aviso global ya mostró el error de la API.
    }
  }

  async function destroy(terminal: PaymentTerminal) {
    try {
      await remove.mutateAsync(terminal.id);
      toast.success(t("deleted", { name: terminal.name }));
      setConfirming(null);
    } catch {
      // `terminal_in_use` u otro error: el aviso global ya salió.
    }
  }

  if (terminals.length === 0) {
    return (
      <div className="rounded-etiqueta border border-dashed border-border px-6 py-12 text-center">
        <p className="font-medium">{t("empty")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyDesc")}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card">
        {terminals.map((terminal) => (
          <li key={terminal.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-base font-medium", !terminal.active && "text-muted-foreground")}>{terminal.name}</p>
              <p className="text-sm text-muted-foreground">
                {terminal.provider_label} · {t("paymentsCount", { count: terminal.payments_count ?? 0 })}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                terminal.active ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {terminal.active ? t("statusActive") : t("statusInactive")}
            </span>
            {!terminal.active && (
              <Button variant="outline" className="min-h-11" onClick={() => setActive(terminal, true)}>
                {t("activate")}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-11" aria-label={t("editAria", { name: terminal.name })} onClick={() => onEdit(terminal)}>
              <Pencil size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 hover:text-destructive"
              aria-label={t("deleteAria", { name: terminal.name })}
              onClick={() => setConfirming(terminal)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{inUse ? t("inUseTitle") : t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {confirming && (inUse ? t("inUseDesc", { name: confirming.name, count: confirming.payments_count ?? 0 }) : t("deleteDesc", { name: confirming.name }))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setConfirming(null)}>
              {t("cancel")}
            </Button>
            {confirming && inUse ? (
              confirming.active && (
                <Button className="min-h-11" onClick={() => setActive(confirming, false)} disabled={update.isPending}>
                  {t("deactivate")}
                </Button>
              )
            ) : (
              confirming && (
                <Button variant="destructive" className="min-h-11" onClick={() => destroy(confirming)} disabled={remove.isPending}>
                  {t("delete")}
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
