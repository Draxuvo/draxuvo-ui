"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/store/auth";
import { getSubscription, updateModules } from "@/services/subscription";
import { getPlans } from "@/services/plans";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/types";

const MANAGE_ROLES = new Set(["owner", "admin", "super_admin"]);

// Interruptor por módulo del plan y candado para los demás (FR-027). Desactivar no borra datos.
export function ModuleSettings() {
  const t = useTranslations("subscription");
  const tm = useTranslations("modules");
  const tp = useTranslations("plans");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { user, selectedCompanyId } = useAuthStore();
  const canManage = !!user && MANAGE_ROLES.has(user.role);
  const queryKey = ["subscription", selectedCompanyId];

  const { data: subscription } = useQuery({
    queryKey,
    queryFn: getSubscription,
    retry: false,
    enabled: canManage,
  });

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: Infinity,
    enabled: canManage,
  });

  const save = useMutation({
    mutationFn: updateModules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("modulesSaved"));
    },
    onError: () => toast.error(t("modulesError")),
  });

  if (!canManage || !subscription) return null;

  const available = subscription.available_modules;
  const savedDisabled = available.filter((m) => !subscription.active_modules.includes(m));
  // Mientras se guarda, se muestra lo que se envió.
  const disabled = save.isPending && save.variables ? save.variables : savedDisabled;
  const catalog: ModuleKey[] = plans?.modules ?? available;
  const listFormat = new Intl.ListFormat(locale, { type: "disjunction" });

  function toggle(module: ModuleKey, on: boolean) {
    const next = on ? disabled.filter((m) => m !== module) : [...disabled, module];
    save.mutate(next);
  }

  function plansWith(module: ModuleKey) {
    const keys = (plans?.plans ?? []).filter((p) => p.modules.includes(module)).map((p) => tp(p.key));
    return listFormat.format(keys);
  }

  return (
    <section className="mt-8 rounded-[6px] border border-border bg-card p-4 text-card-foreground shadow-etiqueta sm:p-6">
      <h2 className="font-display text-2xl font-extrabold uppercase leading-none">
        {t("modulesTitle")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("modulesDesc")}</p>
      <ul className="mt-4 divide-y divide-border">
        {catalog.map((module) => {
          const inPlan = available.includes(module);
          const on = inPlan && !disabled.includes(module);
          return (
            <li key={module} className="flex min-h-14 items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{tm(module)}</p>
                <p className={cn("text-sm", on ? "text-sello" : "text-muted-foreground")}>
                  {inPlan
                    ? on
                      ? t("moduleOn")
                      : t("moduleOff")
                    : t("availableIn", { plans: plansWith(module) })}
                </p>
              </div>
              {inPlan ? (
                <Switch
                  checked={on}
                  disabled={save.isPending}
                  onCheckedChange={(checked) => toggle(module, checked)}
                  aria-label={tm(module)}
                  className="h-6 w-11 focus-visible:ring-foreground data-[state=checked]:bg-sello data-[state=unchecked]:bg-muted-foreground/70 [&>span]:size-5 [&>span]:data-[state=checked]:translate-x-5"
                />
              ) : (
                <Lock
                  size={20}
                  strokeWidth={1.75}
                  className="shrink-0 text-muted-foreground"
                  aria-label={t("moduleLocked")}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
