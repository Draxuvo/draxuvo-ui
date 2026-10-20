"use client";
// Crear y editar una orden en una hoja de una columna (controles de 44 px, sin scroll horizontal).
// Los campos dependen del modo de la empresa: `order` (mesa o cliente + conceptos) o `service`
// (cliente, conceptos y, plegado en "Más detalles", pasos, fecha, prioridad y notas).
// Con `staff` (spec 015) el operador crea su propia orden: solo título, cliente y productos del catálogo con
// cantidad; la API la asigna a su empleado y pone los precios.
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, expectModuleLock } from "@/lib/api";
import { employeesService } from "@/services/employees";
import { useCreateWorkOrder, useUpdateWorkOrder } from "@/hooks/use-work-orders";
import { useAppRouter } from "@/hooks/use-router";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import type { Employee, Product, WorkOrder, WorkOrderPriority } from "@/types";

const PRIORITIES: WorkOrderPriority[] = ["low", "medium", "high", "urgent"];

const FIELD = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const AREA = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring";

type FormValues = {
  title: string;
  employee_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  priority: WorkOrderPriority;
  due_date: string;
  notes: string;
};

type ItemRow = {
  id?: number;
  product_id?: number;
  description: string;
  unit?: string;
  quantity: string;
  unit_price: string;
};

type StepRow = { id?: number; description: string };

const EMPTY_ITEM: ItemRow = { description: "", quantity: "1", unit_price: "" };

function valuesFor(order?: WorkOrder): FormValues {
  return {
    title: order?.title ?? "",
    employee_id: order?.employee ? String(order.employee.id) : "",
    customer_name: order?.customer_name ?? "",
    customer_phone: order?.customer_phone ?? "",
    customer_address: order?.customer_address ?? "",
    priority: order?.priority ?? "medium",
    due_date: order?.due_date ? order.due_date.slice(0, 10) : "",
    notes: order?.notes ?? "",
  };
}

export function OrderForm({
  open,
  onOpenChange,
  order,
  staff = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: WorkOrder;
  staff?: boolean;
}) {
  const t = useTranslations("workOrders");
  const tf = useTranslations("workOrders.form");
  const tc = useTranslations("common");
  const router = useAppRouter();
  const editing = !!order;
  const mode = useAuthStore(
    (s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.order_mode ?? "service",
  );
  const isOrderMode = mode === "order";

  const create = useCreateWorkOrder();
  const update = useUpdateWorkOrder(order?.id ?? 0);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [itemsError, setItemsError] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, isOrderMode ? tf("tableRequired") : tf("titleRequired")),
        employee_id: z.string(),
        customer_name: z.string(),
        customer_phone: z.string(),
        customer_address: z.string(),
        priority: z.enum(["low", "medium", "high", "urgent"]),
        due_date: z.string(),
        notes: z.string(),
      }),
    [isOrderMode, tf],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: valuesFor(order) });

  useEffect(() => {
    if (!open) return;
    reset(valuesFor(order));
    setItems(
      (order?.items ?? []).map((i) => ({
        id: i.id,
        product_id: i.product_id ?? i.product?.id,
        description: i.description,
        unit: i.unit,
        quantity: String(i.quantity),
        unit_price: i.unit_price != null ? String(i.unit_price) : "",
      })),
    );
    setSteps((order?.steps ?? []).map((s) => ({ id: s.id, description: s.description })));
    setItemsError(false);
    setMoreOpen(false);
  }, [open, order, reset]);

  // Quien no tiene el módulo de empleados recibe 403: se oculta el selector y no hay toast.
  useEffect(() => (open && !staff ? expectModuleLock("employees") : undefined), [open, staff]);
  const { data: employeesData } = useQuery({
    queryKey: ["employees", "assignee-select"],
    queryFn: () => employeesService.list({ page: 1, page_size: 100, status: "active" }),
    enabled: open && !staff,
    retry: false,
  });
  const employees: Employee[] = employeesData?.results ?? [];

  const { data: productsData } = useQuery({
    queryKey: ["products-selector"],
    queryFn: () => apiClient.get("/api/v1/products?page_size=100").then((r) => r.data),
    enabled: open,
  });
  const products: Product[] = productsData?.results ?? productsData ?? [];
  const byCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    (acc[p.category ?? "General"] ??= []).push(p);
    return acc;
  }, {});

  const patchItem = (idx: number, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  function pickProduct(idx: number, value: string) {
    const product = products.find((p) => p.id === Number(value));
    if (!product) return patchItem(idx, { product_id: undefined });
    patchItem(idx, {
      product_id: product.id,
      description: product.name,
      unit_price: String(product.price ?? product.unit_cost ?? ""),
    });
  }

  async function onSubmit(values: FormValues) {
    if (staff) return submitStaff(values);
    const rows = items.filter((r) => r.description.trim());
    const invalid = rows.some(
      (r) => !(Number(r.quantity) > 0) || (r.unit_price !== "" && !(Number(r.unit_price) >= 0)),
    );
    setItemsError(invalid);
    if (invalid) return;

    const work_order: Record<string, unknown> = {
      title: values.title.trim(),
      employee_id: values.employee_id ? Number(values.employee_id) : null,
    };
    if (!isOrderMode) {
      Object.assign(work_order, {
        customer_name: values.customer_name.trim() || null,
        customer_phone: values.customer_phone.trim() || null,
        customer_address: values.customer_address.trim() || null,
        priority: values.priority,
        due_date: values.due_date || null,
        notes: values.notes.trim() || null,
      });
    }
    const body: Record<string, unknown> = {
      work_order,
      items: rows.map((r, position) => ({
        ...(r.id ? { id: r.id } : {}),
        ...(r.product_id ? { product_id: r.product_id } : {}),
        description: r.description.trim(),
        ...(r.unit ? { unit: r.unit } : {}),
        quantity: Number(r.quantity),
        ...(r.unit_price !== "" ? { unit_price: Number(r.unit_price) } : {}),
        position,
      })),
    };
    if (!isOrderMode) {
      body.steps = steps
        .filter((s) => s.description.trim())
        .map((s, position) => ({ ...(s.id ? { id: s.id } : {}), description: s.description.trim(), position }));
    }

    try {
      if (editing) {
        await update.mutateAsync(body);
        toast.success(t("updateSuccess"));
        onOpenChange(false);
      } else {
        const created = await create.mutateAsync(body);
        toast.success(t("createSuccess"));
        onOpenChange(false);
        router.push(`/ordenes/${created.id}`);
      }
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { details?: unknown } } } };
      const details = apiError.response?.data?.error?.details;
      toast.error(tc("error"), { description: typeof details === "string" ? details : undefined });
    }
  }

  // El operador manda solo qué es, el cliente y productos del catálogo con cantidad (FR-001 a FR-004).
  async function submitStaff(values: FormValues) {
    const rows = items.filter((r) => r.product_id || r.quantity !== "1");
    const invalid = rows.some((r) => !r.product_id || !(Number(r.quantity) > 0));
    setItemsError(invalid);
    if (invalid) return;

    const work_order: Record<string, unknown> = { title: values.title.trim() };
    if (!isOrderMode) {
      Object.assign(work_order, {
        customer_name: values.customer_name.trim() || null,
        customer_phone: values.customer_phone.trim() || null,
      });
    }
    try {
      const created = await create.mutateAsync({
        work_order,
        items: rows.map((r) => ({ product_id: r.product_id, quantity: Number(r.quantity) })),
      });
      toast.success(t("createSuccess"));
      onOpenChange(false);
      router.push(`/mis-ordenes/${created.id}`);
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(tc("error"), { description: apiError.response?.data?.error?.message });
    }
  }

  const titleLabel = isOrderMode ? tf("tableLabel") : tf("titleLabel");
  const titlePlaceholder = isOrderMode ? tf("tablePlaceholder") : tf("titlePlaceholder");
  const busy = isSubmitting || create.isPending || update.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-4 sm:px-6">
          <SheetTitle className="text-base">{editing ? tf("editTitle") : tf("newTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{titleLabel}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
            <Field label={titleLabel} error={errors.title?.message}>
              <Input {...register("title")} className="h-11" placeholder={titlePlaceholder} autoComplete="off" />
            </Field>

            {!isOrderMode && (
              <fieldset className="space-y-3">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {tf("customer")}
                </legend>
                <Field label={tf("customerName")}>
                  <Input {...register("customer_name")} className="h-11" placeholder={tf("customerNamePlaceholder")} />
                </Field>
                <Field label={tf("customerPhone")}>
                  <Input
                    {...register("customer_phone")}
                    type="tel"
                    inputMode="tel"
                    className="h-11"
                    placeholder={tf("customerPhonePlaceholder")}
                  />
                </Field>
                {!staff && (
                  <Field label={tf("customerAddress")}>
                    <Input {...register("customer_address")} className="h-11" placeholder={tf("customerAddressPlaceholder")} />
                  </Field>
                )}
              </fieldset>
            )}

            {!staff && employeesData && (
              <Field label={tf("assignee")}>
                <select {...register("employee_id")} className={FIELD}>
                  <option value="">{tf("assigneeNone")}</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {/* Conceptos */}
            <section className="space-y-3" aria-labelledby="order-form-items">
              <div>
                <h3 id="order-form-items" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {tf("items")}
                </h3>
                <p className="text-xs text-muted-foreground">{staff ? tf("staffItemsHint") : tf("itemsHint")}</p>
              </div>
              {items.map((row, idx) => (
                <div key={row.id ?? idx} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={t("concepts.product")}
                      value={row.product_id ?? ""}
                      onChange={(e) => pickProduct(idx, e.target.value)}
                      className={FIELD}
                    >
                      <option value="">{staff ? t("concepts.pickProduct") : t("concepts.addFree")}</option>
                      {Object.entries(byCategory).map(([cat, list]) => (
                        <optgroup key={cat} label={cat}>
                          {list.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      aria-label={t("aria.removeItem")}
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </div>
                  {!staff && (
                    <Input
                      className="h-11"
                      value={row.description}
                      onChange={(e) => patchItem(idx, { description: e.target.value })}
                      placeholder={t("concepts.freePlaceholder")}
                      aria-label={t("concepts.freeDescription")}
                    />
                  )}
                  <div className={cn("grid gap-2", staff ? "grid-cols-1" : "grid-cols-2")}>
                    <Input
                      className="h-11"
                      value={row.quantity}
                      onChange={(e) => patchItem(idx, { quantity: e.target.value })}
                      inputMode="decimal"
                      aria-label={t("concepts.quantity")}
                      placeholder={t("concepts.quantity")}
                    />
                    {!staff && (
                      <Input
                        className="h-11"
                        value={row.unit_price}
                        onChange={(e) => patchItem(idx, { unit_price: e.target.value })}
                        inputMode="decimal"
                        aria-label={t("concepts.price")}
                        placeholder={t("concepts.price")}
                      />
                    )}
                  </div>
                </div>
              ))}
              {itemsError && (
                <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle size={11} aria-hidden="true" />
                  {staff ? tf("staffInvalidItem") : tf("invalidNumber")}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full gap-1.5"
                onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
              >
                <Plus size={14} aria-hidden="true" />
                {tf("addItem")}
              </Button>
            </section>

            {/* Más detalles (solo servicio y solo el jefe) */}
            {!isOrderMode && !staff && (
              <section className="space-y-4">
                <button
                  type="button"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                  className="flex min-h-11 w-full items-center justify-between rounded-lg text-sm font-medium text-foreground foco-etiqueta"
                >
                  {moreOpen ? tf("lessDetails") : tf("moreDetails")}
                  <ChevronDown size={16} aria-hidden="true" className={moreOpen ? "rotate-180" : ""} />
                </button>
                {moreOpen && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium">{tf("steps")}</p>
                        <p className="text-xs text-muted-foreground">{tf("stepsHint")}</p>
                      </div>
                      {steps.map((s, idx) => (
                        <div key={s.id ?? idx} className="flex items-center gap-2">
                          <Input
                            className="h-11"
                            value={s.description}
                            placeholder={tf("stepPlaceholder")}
                            aria-label={`${tf("steps")} ${idx + 1}`}
                            onChange={(e) =>
                              setSteps((prev) => prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0"
                            aria-label={t("aria.removeStep")}
                            onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full gap-1.5"
                        onClick={() => setSteps((prev) => [...prev, { description: "" }])}
                      >
                        <Plus size={14} aria-hidden="true" />
                        {tf("addStep")}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label={tf("date")}>
                        <Input {...register("due_date")} type="date" className="h-11" />
                      </Field>
                      <Field label={tf("priority")}>
                        <select {...register("priority")} className={FIELD}>
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {t(`priorities.${p}`)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <Field label={tf("notes")}>
                      <textarea {...register("notes")} rows={3} className={AREA} placeholder={tf("notesPlaceholder")} />
                    </Field>
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-border/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="min-h-11 flex-1" disabled={busy}>
              {busy ? t("saving") : editing ? tf("submit") : tf("create")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle size={11} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
