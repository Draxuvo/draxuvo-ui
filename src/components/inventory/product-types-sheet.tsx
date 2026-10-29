// src/components/inventory/product-types-sheet.tsx
// Tipos de producto de la empresa (spec 016, US1): nombre y reglas (se vende, se cuenta, decimales, unidad).
// Admin y dueño los crean, editan, desactivan o borran (sin productos); los demás solo los ven.
"use client";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProductGlyph } from "@/components/product-icon";
import { IconPicker } from "./icon-picker";
import {
  useCreateProductType,
  useDeleteProductType,
  useMoveProducts,
  useProductTypes,
  useUnits,
  useUpdateProductType,
} from "@/hooks/use-product-types";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/types";
import { Select } from "@/components/ui/select";

type Values = { name: string; sellable: boolean; in_menu: boolean; counted: boolean; fractional: boolean; default_unit_key: string; active: boolean; icon: string };

function apiCode(error: unknown): string | undefined {
  return isAxiosError(error) ? error.response?.data?.error?.details?.code : undefined;
}

export function ProductTypesSheet({ open, onOpenChange, canManage }: { open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean }) {
  const t = useTranslations("inventory.types");
  const types = useProductTypes({ includeInactive: canManage, enabled: open });
  const menuRule = useMenuRule();
  const [editing, setEditing] = useState<ProductType | "new" | null>(null);
  const [removing, setRemoving] = useState<ProductType | null>(null);

  return (
    <Sheet open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setEditing(null); setRemoving(null); } }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle className="text-base">{t("title")}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">{canManage ? t("hint") : t("readOnly")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {editing ? (
            <TypeForm key={editing === "new" ? "new" : editing.id} type={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          ) : removing ? (
            <RemoveType type={removing} others={(types.data ?? []).filter((item) => item.active && item.id !== removing.id)} onDone={() => setRemoving(null)} />
          ) : (
            <>
              <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card">
                {(types.data ?? []).map((type) => (
                  <li key={type.id} className="flex items-center gap-3 px-4 py-3">
                    {type.icon && <ProductGlyph product={{ icon: type.icon }} size={20} className="text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", !type.active && "text-muted-foreground")}>
                        {type.name}
                        {!type.active && <span className="ml-2 text-xs font-normal">({t("inactive")})</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{rulesText(t, type, menuRule)} · {t("productsCount", { count: type.products_count })}</p>
                    </div>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" className="size-10" aria-label={t("editAria", { name: type.name })} onClick={() => setEditing(type)}>
                          <Pencil size={15} aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-10 hover:text-destructive" aria-label={t("deleteAria", { name: type.name })} onClick={() => setRemoving(type)}>
                          <Trash2 size={15} aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {canManage && (
                <Button variant="outline" className="min-h-11 w-full gap-1.5" onClick={() => setEditing("new")}>
                  <Plus size={14} aria-hidden="true" />
                  {t("new")}
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** El menú del servicio solo aplica a los negocios que toman pedido (restaurante). */
function useMenuRule() {
  return useAuthStore((s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.order_mode) === "order";
}

function rulesText(t: ReturnType<typeof useTranslations>, type: ProductType, menuRule: boolean) {
  return [
    type.sellable ? t("rules.sellable") : t("rules.notSellable"),
    menuRule && type.sellable && type.in_menu === false && t("rules.offMenu"),
    type.counted ? t("rules.counted") : t("rules.notCounted"),
    type.fractional && t("rules.fractional"),
    type.default_unit?.name,
  ].filter(Boolean).join(" · ");
}

function TypeForm({ type, onDone }: { type: ProductType | null; onDone: () => void }) {
  const t = useTranslations("inventory.types");
  const tc = useTranslations("common");
  const ti = useTranslations("productIcons");
  const create = useCreateProductType();
  const update = useUpdateProductType();
  const units = useUnits();
  const menuRule = useMenuRule();

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("nameRequired")).max(40, t("nameTooLong")),
        sellable: z.boolean(),
        in_menu: z.boolean(),
        counted: z.boolean(),
        fractional: z.boolean(),
        default_unit_key: z.string().min(1),
        active: z.boolean(),
        icon: z.string(),
      }),
    [t],
  );
  const { register, handleSubmit, control, setValue, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      name: type?.name ?? "",
      sellable: type?.sellable ?? true,
      in_menu: type?.in_menu ?? true,
      counted: type?.counted ?? false,
      fractional: type?.fractional ?? false,
      default_unit_key: type?.default_unit?.key ?? "pza",
      active: type?.active ?? true,
      icon: type?.icon ?? "",
    },
  });
  const counted = useWatch({ control, name: "counted" });
  const sellable = useWatch({ control, name: "sellable" });

  async function onSubmit(values: Values) {
    const data = { ...values, name: values.name.trim(), fractional: values.counted && values.fractional, icon: values.icon || null };
    try {
      if (type) await update.mutateAsync({ id: type.id, data });
      else await create.mutateAsync(data);
      toast.success(t("saved"));
      onDone();
    } catch (error) {
      const code = apiCode(error);
      if (code === "fractional_stock") {
        const names = (isAxiosError(error) ? error.response?.data?.error?.details?.products : []) as string[];
        setError("fractional", { message: t("fractionalStock", { products: names.join(", ") }) });
      } else if (isAxiosError(error) && error.response?.data?.error?.details?.name) {
        setError("name", { message: t("nameTaken") });
      }
    }
  }

  const toggle = (name: "sellable" | "in_menu" | "counted" | "fractional" | "active", label: string, hint?: string, disabled = false) => (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={`type-${name}`} className="text-sm font-medium text-foreground">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            id={`type-${name}`}
            aria-label={label}
            checked={field.value}
            disabled={disabled}
            onCheckedChange={(value) => {
              field.onChange(value);
              if (name === "counted" && !value) setValue("fractional", false);
            }}
          />
        )}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="type-name" className="text-xs font-medium text-foreground">{t("name")}</Label>
        <Input id="type-name" className="h-11" placeholder={t("namePlaceholder")} {...register("name")} />
        {errors.name && <p role="alert" className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      {toggle("sellable", t("rules.sellableLabel"), t("rules.sellableHint"))}
      {menuRule && sellable && toggle("in_menu", t("rules.inMenuLabel"), t("rules.inMenuHint"))}
      {toggle("counted", t("rules.countedLabel"), t("rules.countedHint"))}
      {toggle("fractional", t("rules.fractionalLabel"), t("rules.fractionalHint"), !counted)}
      {errors.fractional && <p role="alert" className="text-xs text-destructive">{errors.fractional.message}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="type-unit" className="text-xs font-medium text-foreground">{t("defaultUnit")}</Label>
        <Select id="type-unit" {...register("default_unit_key")}>
          {(units.data ?? [{ key: "pza", name: "Pieza" }]).map((unit) => (
            <option key={unit.key} value={unit.key}>{unit.name}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground">{ti("title")}</Label>
        <Controller control={control} name="icon" render={({ field }) => <IconPicker value={field.value} onChange={(key) => field.onChange(key ?? "")} />} />
      </div>
      {type && toggle("active", t("active"))}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={onDone}>{tc("cancel")}</Button>
        <Button type="submit" className="min-h-11" disabled={isSubmitting || create.isPending || update.isPending}>{tc("save")}</Button>
      </div>
    </form>
  );
}

// Un tipo con productos no se borra (FR-003): se desactiva o sus productos pasan a otro tipo.
function RemoveType({ type, others, onDone }: { type: ProductType; others: ProductType[]; onDone: () => void }) {
  const t = useTranslations("inventory.types");
  const tc = useTranslations("common");
  const remove = useDeleteProductType();
  const update = useUpdateProductType();
  const move = useMoveProducts();
  const [target, setTarget] = useState(others[0] ? String(others[0].id) : "");
  const inUse = type.products_count > 0;

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      onDone();
    } catch {
      // El aviso global ya mostró el error de la API.
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{inUse ? t("inUseTitle", { name: type.name }) : t("deleteTitle", { name: type.name })}</p>
      <p className="text-sm text-muted-foreground">
        {inUse ? t("inUseDesc", { count: type.products_count }) : t("deleteDesc")}
      </p>
      {inUse ? (
        <div className="space-y-3">
          {others.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="move-target" className="text-xs font-medium text-foreground">{t("moveTo")}</Label>
              <Select id="move-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                {others.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              <Button className="min-h-11 w-full" disabled={!target || move.isPending}
                onClick={() => run(() => move.mutateAsync({ id: type.id, toId: Number(target) }), t("moved"))}>
                {t("move")}
              </Button>
            </div>
          )}
          {type.active && (
            <Button variant="outline" className="min-h-11 w-full" disabled={update.isPending}
              onClick={() => run(() => update.mutateAsync({ id: type.id, data: { active: false } }), t("deactivated", { name: type.name }))}>
              {t("deactivate")}
            </Button>
          )}
        </div>
      ) : (
        <Button variant="destructive" className="min-h-11 w-full" disabled={remove.isPending}
          onClick={() => run(() => remove.mutateAsync(type.id), t("deleted", { name: type.name }))}>
          {t("delete")}
        </Button>
      )}
      <Button variant="ghost" className="min-h-11 w-full" onClick={onDone}>{tc("cancel")}</Button>
    </div>
  );
}
