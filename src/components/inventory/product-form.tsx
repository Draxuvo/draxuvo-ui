// src/components/inventory/product-form.tsx
// Alta y edición de producto. El tipo (spec 016) decide los campos: precio, estación y "disponible" si se vende;
// existencia, mínimo y unidad si se cuenta; decimales si el tipo los admite.
"use client";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
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
import { IconPicker } from "./icon-picker";
import { inventoryService, type ProductPayload } from "@/services/inventory";
import { useModuleGate } from "@/components/subscription/module-locked";
import { useStations } from "@/hooks/use-restaurant";
import { useProductTypes, useUnits } from "@/hooks/use-product-types";
import type { Product } from "@/types";

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  /** Tipo propuesto al dar de alta (la pestaña abierta en Inventario). */
  defaultTypeId?: number | null;
  /** Solo administrador y dueño cambian el icono (spec 026); la API también lo valida. */
  canEditIcon?: boolean;
}

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

type FormValues = {
  product_type_id: string;
  sku: string;
  name: string;
  unit_cost: number;
  stock?: number;
  min_stock?: number;
  unit_key?: string;
  price?: number;
  category?: string;
  description?: string;
  available?: boolean;
  station_id?: string;
  icon?: string;
};

export function ProductForm({ open, onOpenChange, product, defaultTypeId, canEditIcon = false }: ProductFormProps) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const ti = useTranslations("productIcons");
  const qc = useQueryClient();
  const isEdit = !!product;

  const types = useProductTypes({ enabled: open });
  const units = useUnits({ enabled: open });

  const schema = useMemo(
    () =>
      z.object({
        product_type_id: z.string().min(1, t("typeRequired")),
        sku: z.string().min(1, t("skuRequired")),
        name: z.string().min(1, t("nameRequired")),
        unit_cost: z.coerce.number().min(0),
        stock: z.coerce.number().min(0).optional(),
        min_stock: z.coerce.number().min(0).optional(),
        unit_key: z.string().optional(),
        price: z.coerce.number().min(0).optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        available: z.boolean().optional(),
        station_id: z.string().optional(),
        icon: z.string().optional(),
      }),
    [t],
  );

  const { register, handleSubmit, reset, setError, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { product_type_id: "", sku: "", name: "", stock: 0, min_stock: 0, unit_cost: 0, price: 0, category: "", description: "", available: true, station_id: "", unit_key: "", icon: "" },
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
      product_type_id: source?.product_type ? String(source.product_type.id) : defaultTypeId ? String(defaultTypeId) : "",
      sku: source?.sku ?? "",
      name: source?.name ?? "",
      stock: source?.stock ?? 0,
      min_stock: source?.min_stock ?? 0,
      unit_key: source?.unit?.key ?? "",
      unit_cost: source?.unit_cost ?? 0,
      price: source?.price ?? 0,
      category: source?.category ?? "",
      description: source?.description ?? "",
      available: source?.available ?? true,
      station_id: source?.station_id ? String(source.station_id) : "",
      icon: source?.icon ?? "",
    });
  }, [open, productData, isEdit, reset, defaultTypeId]);

  const typeId = useWatch({ control, name: "product_type_id" });
  const type = types.data?.find((item) => String(item.id) === typeId);

  // Estación solo si la empresa tiene el módulo de restaurante.
  const gate = useModuleGate("restaurant");
  const stations = useStations({ enabled: open && gate.enabled });
  const restaurant = !!stations.data;

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: ProductPayload = {
        product_type_id: Number(values.product_type_id),
        sku: values.sku,
        name: values.name,
        unit_cost: values.unit_cost,
        category: values.category,
        description: values.description,
      };
      if (canEditIcon && (values.icon || null) !== (product?.icon ?? null)) payload.icon = values.icon || null;
      if (type?.sellable) {
        Object.assign(payload, { price: values.price, available: values.available });
        if (restaurant) payload.station_id = values.station_id ? Number(values.station_id) : null;
      }
      if (type?.counted) {
        Object.assign(payload, { stock: values.stock, min_stock: values.min_stock ?? 0, unit_key: values.unit_key || null });
      }
      return isEdit ? inventoryService.update(product!.id, payload) : inventoryService.create(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? t("updateSuccess") : t("createSuccess"));
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
  });

  function submit(values: FormValues) {
    if (type?.counted && !type.fractional) {
      for (const field of ["stock", "min_stock"] as const) {
        const value = Number(values[field] ?? 0);
        if (!Number.isInteger(value)) return setError(field, { message: t("quantityWhole") });
      }
    }
    mutation.mutate(values);
  }

  const step = type?.fractional ? "0.001" : "1";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">

        <SheetHeader className="px-6 py-5 border-b border-border/60">
          <SheetTitle className="text-base">
            {isEdit ? t("editTitle") : t("createTitle")}
          </SheetTitle>
        </SheetHeader>

        <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col flex-1">
          <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">

            <div className="space-y-1.5">
              <Label htmlFor="product_type_id" className="text-xs font-medium text-foreground">{t("type")}</Label>
              <select id="product_type_id" {...register("product_type_id")} className={SELECT}>
                <option value="">{t("typePick")}</option>
                {(types.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {errors.product_type_id && <p className="text-xs text-destructive">{errors.product_type_id.message}</p>}
              {type && <p className="text-xs text-muted-foreground">{t(`typeHint.${type.sellable ? "sold" : "notSold"}${type.counted ? "Counted" : ""}`)}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sku" className="text-xs font-medium text-foreground">{t("sku")}</Label>
                <Input id="sku" placeholder={t("skuPlaceholder")} {...register("sku")} />
                {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit_cost" className="text-xs font-medium text-foreground">{t("unitCost")}</Label>
                <Input id="unit_cost" type="number" min="0" step="0.01" placeholder="0.00" {...register("unit_cost")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-foreground">{t("name")}</Label>
              <Input id="name" placeholder={t("namePlaceholder")} {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {type?.counted && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stock" className="text-xs font-medium text-foreground">{t("stock")}</Label>
                  <Input id="stock" type="number" min="0" step={step} {...register("stock")} />
                  {errors.stock && <p className="text-xs text-destructive">{errors.stock.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="min_stock" className="text-xs font-medium text-foreground">{t("minStock")}</Label>
                  <Input id="min_stock" type="number" min="0" step={step} {...register("min_stock")} />
                  {errors.min_stock && <p className="text-xs text-destructive">{errors.min_stock.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit_key" className="text-xs font-medium text-foreground">{t("unit")}</Label>
                  <select id="unit_key" {...register("unit_key")} className={SELECT}>
                    <option value="">{type.default_unit ? t("unitDefault", { unit: type.default_unit.name }) : "—"}</option>
                    {(units.data ?? []).map((unit) => (
                      <option key={unit.key} value={unit.key}>{unit.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {type?.sellable && (
                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-xs font-medium text-foreground">{t("price")}</Label>
                  <Input id="price" type="number" min="0" step="0.01" placeholder={t("pricePlaceholder")} {...register("price")} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-medium text-foreground">{t("category")}</Label>
                <Input id="category" placeholder={t("categoryPlaceholder")} {...register("category")} />
              </div>
            </div>

            {canEditIcon && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{ti("title")}</Label>
                <Controller
                  control={control}
                  name="icon"
                  render={({ field }) => (
                    <IconPicker value={field.value} onChange={(key) => field.onChange(key ?? "")} fallback={type?.icon} />
                  )}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium text-foreground">{t("description")}</Label>
              <textarea
                id="description"
                {...register("description")}
                rows={2}
                placeholder={t("descriptionPlaceholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {type?.sellable && restaurant && (
              <div className="space-y-1.5">
                <Label htmlFor="station_id" className="text-xs font-medium text-foreground">{t("station")}</Label>
                <select id="station_id" {...register("station_id")} className={SELECT}>
                  <option value="">{t("stationNone")}</option>
                  {stations.data!.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {type?.sellable && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="available" {...register("available")} className="h-4 w-4 rounded border-border" />
                <Label htmlFor="available" className="text-xs font-medium text-foreground cursor-pointer">{t("available")}</Label>
              </div>
            )}

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
