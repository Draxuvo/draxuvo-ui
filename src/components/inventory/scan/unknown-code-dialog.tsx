// src/components/inventory/scan/unknown-code-dialog.tsx
// Un código que no existe (spec 034): ofrece crear el producto con ese código ya puesto.
"use client";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UnknownCodeDialogProps {
  code: string | null;
  onCreate: (code: string) => void;
  onCancel: () => void;
}

export function UnknownCodeDialog({ code, onCreate, onCancel }: UnknownCodeDialogProps) {
  const t = useTranslations("inventory.scan");
  return (
    <Dialog open={code !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("unknownTitle")}</DialogTitle>
          <DialogDescription>{t("unknownBody", { code: code ?? "" })}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("unknownSkip")}
          </Button>
          <Button type="button" autoFocus onClick={() => code && onCreate(code)}>
            {t("unknownCreate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
