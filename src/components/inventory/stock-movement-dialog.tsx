// src/components/inventory/stock-movement-dialog.tsx
"use client";
import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inventoryService } from "@/services/inventory";
import type { Product } from "@/types";

interface StockMovementDialogProps {
  product: Product | null;
  movementType: "entry" | "exit" | null;
  onOpenChange: (open: boolean) => void;
}

export function StockMovementDialog({
  product,
  movementType,
  onOpenChange,
}: StockMovementDialogProps) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const qc = useQueryClient();

  const schema = z.object({
    qty: z.coerce.number().int().min(1, t("quantityMin")),
    note: z.string().optional(),
  });

  type FormValues = {
    qty: number;
    note?: string;
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { qty: 1, note: "" },
  });

  const open = !!product && !!movementType;

  useEffect(() => {
    if (open) reset({ qty: 1, note: "" });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      inventoryService.addMovement(product!.id, {
        movement_type: movementType!,
        qty: values.qty,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      toast.success(movementType === "entry" ? t("entrySuccess") : t("exitSuccess"));
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
  });

  const title = movementType === "entry"
    ? t("entryTitle", { name: product?.name ?? "" })
    : t("exitTitle", { name: product?.name ?? "" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {product && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("currentStock", { stock: product.stock })}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">{t("quantity")}</Label>
            <Input
              type="number"
              min="1"
              {...register("qty")}
            />
            {errors.qty && (
              <p className="text-xs text-destructive">{errors.qty.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">{t("note")}</Label>
            <Input placeholder={t("notePlaceholder")} {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? tc("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
