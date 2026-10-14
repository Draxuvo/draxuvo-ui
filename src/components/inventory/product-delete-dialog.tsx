// src/components/inventory/product-delete-dialog.tsx
"use client";
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
import type { Product } from "@/types";

interface ProductDeleteDialogProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
}

export function ProductDeleteDialog({ product, onOpenChange }: ProductDeleteDialogProps) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => inventoryService.remove(product!.id),
    onSuccess: () => {
      toast.success(t("deleteSuccess"));
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("deleteConfirm", { name: product?.name ?? "" })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t("deleting") : tc("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
