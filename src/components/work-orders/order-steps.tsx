"use client";
// Pasos por hacer de la orden. La casilla viene de `check_steps`; agregar, editar y borrar de `edit_steps`.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAddStep, useDeleteStep, useUpdateStep } from "@/hooks/use-work-orders";
import type { WorkOrder, WorkOrderAction } from "@/types";
import { cn } from "@/lib/utils";

export function OrderSteps({ order }: { order: WorkOrder }) {
  const t = useTranslations("workOrders");
  const can = (action: WorkOrderAction) => order.allowed_actions?.includes(action) ?? false;
  const [text, setText] = useState("");
  const add = useAddStep(order.id);
  const update = useUpdateStep(order.id);
  const remove = useDeleteStep(order.id);
  const steps = order.steps ?? [];

  function onAdd(event: React.FormEvent) {
    event.preventDefault();
    const description = text.trim();
    if (!description) return;
    add.mutate({ description, position: steps.length }, {
      onSuccess: () => setText(""),
      onError: () => toast.error(t("errors.forbidden")),
    });
  }

  return (
    <section aria-labelledby="order-steps-title" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="order-steps-title" className="font-heading text-lg font-semibold">
          {t("steps.title")}
        </h2>
        {steps.length > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("steps.progress", { done: order.steps_done, total: order.steps_count })}
          </p>
        )}
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("steps.empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-3 px-3 py-1">
              <label className={cn("flex min-h-11 flex-1 items-center gap-3", can("check_steps") && "cursor-pointer")}>
                <input
                  type="checkbox"
                  checked={step.done}
                  disabled={!can("check_steps") || update.isPending}
                  onChange={() => update.mutate({ stepId: step.id, data: { done: !step.done } })}
                  aria-label={step.done ? t("steps.uncheck", { description: step.description }) : t("steps.check", { description: step.description })}
                  className="size-6 shrink-0 accent-primary"
                />
                <span className={cn("text-base", step.done && "text-muted-foreground line-through")}>
                  {step.description}
                </span>
              </label>
              {can("edit_steps") && (
                <button
                  type="button"
                  onClick={() => remove.mutate(step.id)}
                  aria-label={t("aria.removeStep")}
                  className="grid size-11 shrink-0 place-items-center rounded-etiqueta text-muted-foreground hover:text-destructive foco-etiqueta"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {can("edit_steps") && (
        <form onSubmit={onAdd} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("steps.placeholder")}
            aria-label={t("steps.add")}
            className="h-11"
          />
          <Button type="submit" variant="outline" className="h-11 gap-1" disabled={add.isPending || !text.trim()}>
            <Plus size={16} aria-hidden="true" />
            {t("steps.add")}
          </Button>
        </form>
      )}
    </section>
  );
}
