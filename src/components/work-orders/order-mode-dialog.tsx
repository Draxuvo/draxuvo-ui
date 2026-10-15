"use client";
// Cómo trabaja la empresa sus órdenes: pedido (mesa y menú) o servicio (cliente, pasos y fotos).
// Solo el dueño lo cambia; las órdenes que ya existen se siguen viendo completas.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardList, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateOrderMode } from "@/hooks/use-work-orders";
import { useAuthStore } from "@/store/auth";
import type { OrderMode } from "@/types";
import { cn } from "@/lib/utils";

const OPTIONS: { key: OrderMode; icon: typeof ClipboardList }[] = [
  { key: "order", icon: UtensilsCrossed },
  { key: "service", icon: ClipboardList },
];

export function OrderModeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("workOrders.mode");
  const current = useAuthStore((s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.order_mode ?? "service");
  const [chosen, setChosen] = useState<OrderMode>(current);
  const update = useUpdateOrderMode();

  function save() {
    update.mutate(chosen, {
      onSuccess: () => {
        toast.success(t("saved"));
        onOpenChange(false);
      },
      onError: () => toast.error(t("error")),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setChosen(current);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="sr-only">{t("title")}</legend>
          {OPTIONS.map(({ key, icon: Icon }) => (
            <label key={key} className="block cursor-pointer">
              <input type="radio" name="order-mode" value={key} checked={chosen === key} onChange={() => setChosen(key)} className="peer sr-only" />
              <span
                className={cn(
                  "flex min-h-20 items-start gap-3 rounded-etiqueta border-2 p-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                  chosen === key ? "border-foreground bg-muted" : "border-border bg-card hover:bg-muted",
                )}
              >
                <Icon size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-heading text-lg font-semibold">
                    {t(key)}
                    {current === key && <span className="ml-2 text-xs font-medium text-muted-foreground">({t("current")})</span>}
                  </span>
                  <span className="block text-sm text-muted-foreground">{t(`${key}Hint`)}</span>
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <DialogFooter>
          <Button className="h-11" onClick={save} disabled={update.isPending || chosen === current}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
