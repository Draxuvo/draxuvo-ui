// src/components/inventory/product-form.tsx
"use client";
import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inventoryService } from "@/services/inventory";
import { useModuleGate } from "@/components/subscription/module-locked";
import { useStations } from "@/hooks/use-restaurant";
import type { Product } from "@/types";

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductForm({ open, onOpenChange, product }: ProductFormProps) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const isEdit = !!product;

  const schema = z.object({
    sku: z.string().min(1, t("skuRequired")),
    name: z.string().min(1, t("nameRequired")),
    stock: z.coerce.number().int().min(0).optional(),
    min_stock: z.coerce.number().int().min(0),
    unit_cost: z.coerce.number().min(0),
    price: z.coerce.number().min(0).optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    available: z.boolean().optional(),
    station_id: z.string().optional(),
    tracks_stock: z.boolean().optional(),
  });

  type FormValues = {
    sku: string;
    name: string;
    min_stock: number;
    unit_cost: number;
    stock?: number;
    price?: number;
    category?: string;
    description?: string;
    available?: boolean;
    station_id?: string;
    tracks_stock?: boolean;
  };

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { sku: "", name: "", stock: 0, min_stock: 0, unit_cost: 0, price: 0, category: "", description: "", available: true, station_id: "", tracks_stock: false },
  });

  const { data: productData } = useQuery({
    queryKey: ["products", product?.id],
    queryFn: () => inventoryService.getById(product!.id),
    enabled: open && isEdit,
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && !productData) return;
    const source = isEdit ? productData : null;
    reset({
      sku: source?.sku ?? "",
      name: source?.name ?? "",
      stock: source?.stock ?? 0,
      min_stock: source?.min_stock ?? 0,
      unit_cost: source?.unit_cost ?? 0,
      price: source?.price ?? 0,
      category: source?.category ?? "",
      description: source?.description ?? "",
      available: source?.available ?? true,
      station_id: source?.station_id ? String(source.station_id) : "",
      tracks_stock: source?.tracks_stock ?? false,
    });
  }, [open, productData, isEdit, reset]);

  // Estación y control de inventario solo existen si la empresa tiene el módulo de restaurante.
  const gate = useModuleGate("restaurant");
  const stations = useStations({ enabled: open && gate.enabled });
  const restaurant = !!stations.data;

  const mutation = useMutation({
    mutationFn: ({ station_id, ...values }: FormValues) => {
      const payload = restaurant ? { ...values, station_id: station_id ? Number(station_id) : null } : values;
      return isEdit ? inventoryService.update(product!.id, payload) : inventoryService.create(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? t("updateSuccess") : t("createSuccess"));
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">

        <SheetHeader className="px-6 py-5 border-b border-border/60">
          <SheetTitle className="text-base">
            {isEdit ? t("editTitle") : t("createTitle")}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col flex-1"
        >
          <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("sku")}</Label>
                <Input placeholder={t("skuPlaceholder")} {...register("sku")} />
                {errors.sku && (
                  <p className="text-xs text-destructive">{errors.sku.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("unitCost")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  {...register("unit_cost")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">{t("name")}</Label>
              <Input placeholder={t("namePlaceholder")} {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("stock")}</Label>
                <Input type="number" min="0" placeholder="0" {...register("stock")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("minStock")}</Label>
                <Input type="number" min="0" placeholder="0" {...register("min_stock")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("price")}</Label>
                <Input type="number" min="0" step="0.01" placeholder={t("pricePlaceholder")} {...register("price")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("category")}</Label>
                <Input placeholder={t("categoryPlaceholder")} {...register("category")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">{t("description")}</Label>
              <textarea
                {...register("description")}
                rows={2}
                placeholder={t("descriptionPlaceholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {restaurant && (
              <div className="space-y-4 rounded-etiqueta border border-border/60 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("restaurantSection")}</p>
                <div className="space-y-1.5">
                  <Label htmlFor="station_id" className="text-xs font-medium text-foreground">{t("station")}</Label>
                  <select
                    id="station_id"
                    {...register("station_id")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">{t("stationNone")}</option>
                    {stations.data!.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="tracks_stock" {...register("tracks_stock")} className="h-4 w-4 rounded border-border" />
                    <Label htmlFor="tracks_stock" className="cursor-pointer text-xs font-medium text-foreground">{t("tracksStock")}</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("tracksStockHint")}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input type="checkbox" id="available" {...register("available")} className="h-4 w-4 rounded border-border" />
              <Label htmlFor="available" className="text-xs font-medium text-foreground cursor-pointer">{t("available")}</Label>
            </div>

          </div>

          <div className="px-6 py-4 border-t border-border/60 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? tc("saving") : tc("save")}
            </Button>
          </div>
        </form>

      </SheetContent>
    </Sheet>
  );
}
