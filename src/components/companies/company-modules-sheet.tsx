// src/components/companies/company-modules-sheet.tsx
// Módulos de una empresa para el super admin (spec 017): solo él los activa y desactiva, y solo los del plan.
// Cada interruptor guarda al momento; si falla, queda como estaba.
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { updateModules } from "@/services/subscription";
import { cn } from "@/lib/utils";
import type { Company, ModuleKey, Subscription } from "@/types";

interface CompanyModulesSheetProps {
  company: Company | null;
  subscription: Subscription | null;
  onOpenChange: (open: boolean) => void;
}

export function CompanyModulesSheet({ company, subscription, onOpenChange }: CompanyModulesSheetProps) {
  const t = useTranslations("companies.modules");
  const tm = useTranslations("modules");
  const tp = useTranslations("companies.plans");
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (disabled: ModuleKey[]) => updateModules(disabled, company!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-subscription", company!.id] });
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("error")),
  });

  const available = subscription?.available_modules ?? [];
  const savedDisabled = available.filter((module) => !subscription?.active_modules.includes(module));
  // Mientras se guarda se muestra lo que se envió; si falla, vuelve a lo guardado.
  const disabled = save.isPending && save.variables ? save.variables : savedDisabled;

  function toggle(module: ModuleKey, on: boolean) {
    save.mutate(on ? disabled.filter((item) => item !== module) : [...disabled, module]);
  }

  return (
    <Sheet open={!!company} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle className="text-base">{t("title", { name: company?.name ?? "" })}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {subscription ? t("planLine", { plan: tp(subscription.plan), status: subscription.status }) : t("noSubscription")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {available.map((module) => {
                const on = !disabled.includes(module);
                return (
                  <li key={module} className="flex min-h-14 items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{tm(module)}</p>
                      <p className={cn("text-sm", on ? "text-sello" : "text-muted-foreground")}>{on ? t("on") : t("off")}</p>
                    </div>
                    <Switch
                      checked={on}
                      disabled={save.isPending}
                      onCheckedChange={(checked) => toggle(module, checked)}
                      aria-label={tm(module)}
                      className="h-6 w-11 data-[state=checked]:bg-sello data-[state=unchecked]:bg-muted-foreground/70 [&>span]:size-5 [&>span]:data-[state=checked]:translate-x-5"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
