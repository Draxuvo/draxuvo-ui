// src/components/inventory/stock-movement-dialog.tsx
"use client";
import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
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
import { formatQuantity } from "@/lib/quantity";
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
  const locale = useLocale();
  const qc = useQueryClient();
  // Con decimales solo en tipos que los admiten (spec 016); los demás, piezas enteras.
  const fractional = !!product?.product_type?.fractional;

  const schema = fractional
    ? z.object({ qty: z.coerce.number().positive(t("quantityPositive")).multipleOf(0.001, t("quantityDecimals")), note: z.string().optional() })
    : z.object({ qty: z.coerce.number().int(t("quantityWhole")).min(1, t("quantityMin")), note: z.string().optional() });

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
              {t("currentStock", { stock: formatQuantity(product.stock, product.unit, locale) })}
            </p>
          )}
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="movement-qty" className="text-xs font-medium text-foreground">
              {product?.unit ? t("quantityIn", { unit: product.unit.name }) : t("quantity")}
            </Label>
            <Input
              id="movement-qty"
              type="number"
              min={fractional ? "0.001" : "1"}
              step={fractional ? "0.001" : "1"}
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
