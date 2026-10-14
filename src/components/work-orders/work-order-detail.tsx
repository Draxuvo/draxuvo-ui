// src/components/work-orders/work-order-detail.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  useUpdateStatus,
  useToggleItem,
  useAddItem,
  useUpdateItem,
  useDeleteItem,
} from "@/hooks/use-work-orders";
import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";
import { ProgressBar } from "./progress-bar";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, Hash, Pencil, Trash2, Plus, Package, Lock, Loader2, Receipt, XCircle } from "lucide-react";
import type { WorkOrder, WorkOrderItem, Product } from "@/types";
import { useAppRouter } from "@/hooks/use-router";
import { useAuthStore } from "@/store/auth";

const STATUSES = ["pending", "in_progress", "in_review", "completed"] as const;
type OrderStatus = (typeof STATUSES)[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  in_review: "En revisión",
  completed: "Completada",
};

const STATUS_STYLE: Record<OrderStatus, { circle: string; label: string; sublabel: string }> = {
  pending:     { circle: "bg-muted-foreground",    label: "text-foreground",   sublabel: "text-muted-foreground" },
  in_progress: { circle: "bg-estado-progreso-border",    label: "text-estado-progreso-foreground",   sublabel: "text-estado-progreso-foreground" },
  in_review:   { circle: "bg-estado-revision-border",  label: "text-estado-revision-foreground", sublabel: "text-estado-revision-foreground" },
  completed:   { circle: "bg-estado-completada-border",    label: "text-estado-completada-foreground",   sublabel: "text-estado-completada-foreground" },
};

const selectCls =
  "w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

const textareaCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring";

interface ItemDraft {
  description: string;
  quantity: number;
  unit: string;
  unit_price: string;
  product_id?: number;
}

const emptyDraft = (): ItemDraft => ({
  description: "",
  quantity: 1,
  unit: "",
  unit_price: "",
  product_id: undefined,
});

function draftFromItem(item: WorkOrderItem): ItemDraft {
  return {
    description: item.description,
    quantity: item.quantity,
    unit: item.unit ?? "",
    unit_price: item.unit_price != null ? String(item.unit_price) : "",
    product_id: item.product_id,
  };
}

function ItemForm({
  draft,
  onChange,
  onSave,
  onCancel,
  isSaving,
  unitGroups,
  productsByCategory,
  saveLabel = "Guardar",
}: {
  draft: ItemDraft;
  onChange: (d: ItemDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  unitGroups: Record<string, { id: number; key: string; name: string }[]>;
  productsByCategory: Record<string, Product[]>;
  saveLabel?: string;
}) {
  const allProducts = Object.values(productsByCategory).flat();

  function handleProductChange(productId: string) {
    const product = allProducts.find((p) => p.id === Number(productId));
    onChange({
      ...draft,
      product_id: productId ? Number(productId) : undefined,
      description: product?.name ?? draft.description,
      unit_price:
        product?.price != null
          ? String(product.price)
          : product?.unit_cost != null
            ? String(product.unit_cost)
            : draft.unit_price,
    });
  }

  return (
    <div className="space-y-3">
      {/* Product picker */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Package size={12} />
          <span className="text-[11px] font-medium">Seleccionar producto (opcional)</span>
        </div>
        <select
          value={draft.product_id ?? ""}
          onChange={(e) => handleProductChange(e.target.value)}
          className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Sin producto</option>
          {Object.entries(productsByCategory).map(([cat, prods]) => (
            <optgroup key={cat} label={cat}>
              {prods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.stock != null ? `  (${p.stock} en stock)` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Description */}
      <Input
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        placeholder="Descripción de la tarea..."
        autoFocus
      />

      {/* Qty + unit + price */}
      <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">Cant.</span>
        <Input
          type="number"
          min={1}
          value={draft.quantity}
          onChange={(e) =>
            onChange({ ...draft, quantity: Math.max(1, Number(e.target.value)) })
          }
          className="text-center"
        />
        <select
          value={draft.unit}
          onChange={(e) => onChange({ ...draft, unit: e.target.value })}
          className={selectCls}
        >
          <option value="">Unidad</option>
          {Object.entries(unitGroups).map(([group, units]) => (
            <optgroup key={group} label={group}>
              {units.map((u) => (
                <option key={u.id} value={u.key}>
                  {u.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            $
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.unit_price}
            onChange={(e) => onChange({ ...draft, unit_price: e.target.value })}
            placeholder="Precio"
            className="pl-5"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={isSaving || !draft.description.trim()}
        >
          {isSaving ? "Guardando..." : saveLabel}
        </Button>
      </div>
    </div>
  );
}

export function WorkOrderDetail({
  order: initialOrder,
  open,
  onClose,
}: {
  order: WorkOrder;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("workOrders");
  const tc = useTranslations("common");
  const tt = useTranslations("tickets");
  const router = useAppRouter();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const ticketsPath = role === "staff" ? "/mis-tickets" : "/tickets";

  const { data: order, isLoading } = useQuery<WorkOrder>({
    queryKey: ["work-orders", initialOrder.id],
    queryFn: () =>
      apiClient.get(`/api/v1/work_orders/${initialOrder.id}`).then((r) => r.data),
    enabled: open,
    staleTime: 0,
  });
  const current = order ?? initialOrder;

  const { data: unitsData } = useQuery({
    queryKey: ["units-catalog"],
    queryFn: () => apiClient.get("/api/v1/units").then((r) => r.data),
  });
  const unitGroups: Record<string, { id: number; key: string; name: string }[]> =
    unitsData?.units ?? {};

  const { data: productsData } = useQuery({
    queryKey: ["products-selector"],
    queryFn: () =>
      apiClient.get("/api/v1/products?page_size=100").then((r) => r.data),
  });
  const allProducts: Product[] = productsData?.results ?? productsData ?? [];
  const productsByCategory = allProducts.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const updateStatus = useUpdateStatus(current.id);
  const toggleItem = useToggleItem(current.id);
  const addItem = useAddItem(current.id);
  const updateItem = useUpdateItem(current.id);
  const deleteItem = useDeleteItem(current.id);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ItemDraft>(emptyDraft());
  const [isAdding, setIsAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<ItemDraft>(emptyDraft());

  const isCancelled = current.status === "cancelled";
  const canEdit = current.status !== "completed" && !isCancelled;
  const hasItems = (current.items?.length ?? 0) > 0;
  const allItemsDone =
    !hasItems || current.items!.every((i) => i.status === "completed");
  const hasPendingItems =
    hasItems && current.items!.some((i) => i.status !== "completed");

  function isStatusBlocked(s: OrderStatus): boolean {
    if (isCancelled) return true;
    if (s === current.status) return false;
    switch (s) {
      case "pending":
        return current.status !== "pending";
      case "in_progress":
      case "in_review":
        return hasItems && !hasPendingItems;
      case "completed":
        return !allItemsDone;
    }
  }

  function statusBlockedReason(s: OrderStatus): string | undefined {
    if (!isStatusBlocked(s)) return undefined;
    switch (s) {
      case "pending":
        return "El estado pendiente solo puede asignarse una vez";
      case "in_progress":
      case "in_review":
        return "Agrega o deja tareas pendientes antes de cambiar a este estado";
      case "completed":
        return "Completa todas las tareas antes de marcar la orden como completada";
    }
  }

  const orderTotal =
    current.total != null
      ? Number(current.total)
      : (current.items?.reduce((sum, item) => {
          const sub =
            item.subtotal != null
              ? Number(item.subtotal)
              : item.unit_price != null
                ? Number(item.unit_price) * item.quantity
                : 0;
          return sum + sub;
        }, 0) ?? 0);

  function startEdit(item: WorkOrderItem) {
    setIsAdding(false);
    setEditingId(item.id);
    setEditDraft(draftFromItem(item));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(emptyDraft());
  }

  async function handleToggle(itemId: number) {
    try {
      await toggleItem.mutateAsync(itemId);
    } catch {
      toast.error(tc("error"));
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    try {
      await updateItem.mutateAsync({
        itemId: editingId,
        data: {
          description: editDraft.description,
          quantity: editDraft.quantity,
          unit: editDraft.unit || undefined,
          unit_price: editDraft.unit_price ? Number(editDraft.unit_price) : undefined,
          ...(editDraft.product_id ? { product_id: editDraft.product_id } : {}),
        },
      });
      cancelEdit();
    } catch {
      toast.error(tc("error"));
    }
  }

  async function handleDelete(itemId: number) {
    try {
      await deleteItem.mutateAsync(itemId);
      if (editingId === itemId) cancelEdit();
    } catch {
      toast.error(tc("error"));
    }
  }

  async function handleAddItem() {
    try {
      await addItem.mutateAsync({
        description: newDraft.description,
        quantity: newDraft.quantity,
        unit: newDraft.unit || undefined,
        unit_price: newDraft.unit_price ? Number(newDraft.unit_price) : undefined,
        ...(newDraft.product_id ? { product_id: newDraft.product_id } : {}),
      });
      setIsAdding(false);
      setNewDraft(emptyDraft());
    } catch {
      toast.error(tc("error"));
    }
  }

  async function handleCancel() {
    try {
      await updateStatus.mutateAsync("cancelled");
      toast.success(t("statusUpdated"));
    } catch {
      toast.error(tc("error"));
    }
  }

  async function handleStatusChange(status: string) {
    if (status === current.status) return;
    try {
      await updateStatus.mutateAsync(status);
      toast.success(t("statusUpdated"));
      if (status === "completed") {
        qc.invalidateQueries({ queryKey: ["tickets"] });
      }
    } catch {
      toast.error(tc("error"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        style={{ width: "min(92vw, 960px)", maxWidth: "none" }}
        className="p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-base flex-1">{current.title}</SheetTitle>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
              <Hash size={11} />
              {current.id}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <PriorityBadge priority={current.priority} />
            <StatusBadge status={current.status} />
          </div>
        </SheetHeader>

        {/* Two-column body */}
        <div className="flex-1 grid grid-cols-[1fr_1.4fr] divide-x divide-border overflow-hidden">

          {/* ── Left: order info ── */}
          <div className="overflow-y-auto px-6 py-6 space-y-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Detalles de la orden
            </p>

            {/* Employee + Due date */}
            {(current.employee || current.due_date) && (
              <div className="grid grid-cols-1 gap-3">
                {current.employee && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{t("employee")}</p>
                    <p className="text-sm text-foreground">{current.employee.name}</p>
                  </div>
                )}
                {current.due_date && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{t("dueDate")}</p>
                    <p className="text-sm text-foreground">
                      {format(new Date(current.due_date), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            {current.items_count > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("progress")}</span>
                  <span className="font-medium text-muted-foreground">
                    {current.items_done}/{current.items_count} · {current.progress}%
                  </span>
                </div>
                <ProgressBar value={current.progress} />
              </div>
            )}

            {/* Description */}
            {current.description && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t("description")}</p>
                <p className="text-sm leading-relaxed text-foreground">{current.description}</p>
              </div>
            )}

            {/* Notes */}
            {current.notes && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t("notes")}</p>
                <p className="text-sm leading-relaxed bg-muted/50 rounded-xl p-3 text-foreground border border-border/60">
                  {current.notes}
                </p>
              </div>
            )}

            {/* View ticket (auto-generated on completion) */}
            {current.status === "completed" && (
              <div className="pt-2 border-t border-border/60 space-y-2">
                <p className="text-[11px] text-muted-foreground">{tt("autoGenerated")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => { router.push(ticketsPath); onClose(); }}
                >
                  <Receipt size={14} />
                  {tt("viewTickets")}
                </Button>
              </div>
            )}
          </div>

          {/* ── Right: tasks ── */}
          <div className="overflow-y-auto px-6 py-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t("items")}
                <span className="text-muted-foreground/50 font-normal ml-1.5 normal-case tracking-normal">
                  ({current.items?.length ?? initialOrder.items_count})
                </span>
              </p>
              {canEdit && !isAdding && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingId(null); setIsAdding(true); setNewDraft(emptyDraft()); }}
                  className="h-7 text-xs gap-1.5"
                >
                  <Plus size={12} />
                  {t("addItem")}
                </Button>
              )}
            </div>

            <div className={`flex flex-col gap-3 ${isCancelled ? "opacity-50 pointer-events-none select-none" : ""}`}>
              {/* Skeleton */}
              {isLoading && !current.items &&
                Array.from({ length: initialOrder.items_count || 2 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))
              }

              {/* Item cards */}
              {current.items?.map((item, idx) => {
                const subtotal =
                  item.subtotal != null
                    ? Number(item.subtotal)
                    : item.unit_price != null
                      ? Number(item.unit_price) * item.quantity
                      : null;
                const hasPricing = item.unit_price != null && Number(item.unit_price) > 0;

                return (
                  <div
                    key={item.id}
                    className="group rounded-xl border border-border bg-muted/30 p-4 space-y-3"
                  >
                    {editingId === item.id ? (
                      <ItemForm
                        draft={editDraft}
                        onChange={setEditDraft}
                        onSave={handleSaveEdit}
                        onCancel={cancelEdit}
                        isSaving={updateItem.isPending}
                        unitGroups={unitGroups}
                        productsByCategory={productsByCategory}
                      />
                    ) : (
                      <>
                        {/* Row: number + description + actions */}
                        <div className="flex items-center gap-3">
                          {/* Toggle */}
                          <button
                            onClick={() => handleToggle(item.id)}
                            disabled={current.status === "completed" || isCancelled || toggleItem.isPending}
                            className="shrink-0 disabled:opacity-50"
                          >
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                item.status === "completed"
                                  ? "bg-estado-completada-border border-estado-completada-border"
                                  : "border-border hover:border-border"
                              }`}
                            >
                              {item.status === "completed" && (
                                <Check size={11} className="text-background" />
                              )}
                            </div>
                          </button>

                          {/* Task label */}
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                            Tarea {idx + 1}
                          </span>

                          <span className="flex-1" />

                          {/* Edit / Delete */}
                          {canEdit && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEdit(item)}
                                className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                disabled={deleteItem.isPending}
                                className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <p
                          className={`text-sm ${
                            item.status === "completed"
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {item.description}
                        </p>

                        {/* Qty / unit / price row */}
                        {(item.quantity > 1 || item.unit || hasPricing) && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                              {hasPricing
                                ? ` · $${Number(item.unit_price).toFixed(2)} c/u`
                                : ""}
                            </span>
                            {subtotal != null && subtotal > 0 && (
                              <span className="text-xs text-muted-foreground">
                                Subtotal:{" "}
                                <span className="font-semibold text-foreground">
                                  ${subtotal.toFixed(2)}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* New item card */}
              {isAdding && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Nueva tarea
                    </span>
                  </div>
                  <ItemForm
                    draft={newDraft}
                    onChange={setNewDraft}
                    onSave={handleAddItem}
                    onCancel={() => { setIsAdding(false); setNewDraft(emptyDraft()); }}
                    isSaving={addItem.isPending}
                    unitGroups={unitGroups}
                    productsByCategory={productsByCategory}
                    saveLabel="Agregar"
                  />
                </div>
              )}
            </div>

            {/* Order total */}
            {orderTotal > 0 && (
              <div className="flex justify-between items-center rounded-xl border border-border bg-card px-4 py-3 mt-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Total
                </span>
                <span className="text-base font-bold text-foreground tabular-nums">
                  ${orderTotal.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal status stepper */}
        <div className="shrink-0 border-t border-border/60 px-6 pt-4 pb-5 space-y-4">
          {/* Cancelled banner */}
          {isCancelled && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3">
              <XCircle size={15} className="text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">{t("statuses.cancelled")}</p>
              <p className="text-xs text-destructive ml-auto">{t("cancelledNote")}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {t("status")}
            </p>
            <div className="relative flex items-start">
              <div className="absolute top-[15px] left-[12.5%] right-[12.5%] h-px bg-muted" />

              {STATUSES.map((s, idx) => {
                const isActive = current.status === s;
                const isBlocked = isStatusBlocked(s);
                const style = STATUS_STYLE[s];

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStatusChange(s)}
                    disabled={isActive || updateStatus.isPending || isBlocked}
                    title={statusBlockedReason(s)}
                    className={`group flex-1 flex flex-col items-center gap-1.5 relative z-10 ${
                      isBlocked ? "cursor-not-allowed" : isActive ? "cursor-default" : ""
                    }`}
                  >
                    <div
                      className={`w-[30px] h-[30px] rounded-full flex items-center justify-center ring-[3px] ring-white transition-all ${
                        isActive
                          ? style.circle
                          : isBlocked
                            ? "bg-muted border border-border"
                            : "bg-card border border-border group-hover:border-border group-hover:bg-muted/50"
                      }`}
                    >
                      {isActive ? (
                        updateStatus.isPending ? (
                          <Loader2 size={13} className="text-background animate-spin" />
                        ) : (
                          <Check size={13} className="text-background" strokeWidth={2.5} />
                        )
                      ) : isBlocked ? (
                        <Lock size={11} className="text-muted-foreground/50" />
                      ) : (
                        <span className="text-[11px] font-bold text-muted-foreground group-hover:text-muted-foreground">
                          {idx + 1}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[11px] font-medium text-center leading-tight px-1 ${
                        isActive
                          ? style.label
                          : isBlocked
                            ? "text-muted-foreground/50"
                            : "text-muted-foreground group-hover:text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </span>

                    {s === "completed" && isBlocked && hasItems && !isCancelled && (
                      <span className="text-[10px] text-muted-foreground/50 leading-none">
                        {current.items_done}/{current.items_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cancel button — only when not completed or already cancelled */}
          {!isCancelled && current.status !== "completed" && (
            <div className="flex justify-end pt-1 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                onClick={handleCancel}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <XCircle size={13} />
                )}
                {t("cancelOrder")}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
