"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import { expectModuleLock } from "@/lib/api";
import type { ModuleKey } from "@/types";

// GET /subscription solo responde a owner y admin; los demás dependen del 403 de la API.
const BILLING_ROLES = new Set(["owner", "admin"]);

// Módulo de un 403 `module_not_in_plan` de la API, o null si el error es otro.
export function moduleNotInPlan(error: unknown): ModuleKey | null {
  if (!isAxiosError(error) || error.response?.status !== 403) return null;
  const details = error.response.data?.error?.details;
  return details?.code === "module_not_in_plan" ? (details.module as ModuleKey) : null;
}

/**
 * Puerta de un módulo para su página (R18): dice si el plan lo bloquea antes de pedir datos.
 * - `enabled`: la página puede consultar su lista (ya se sabe que el módulo está en el plan, o el
 *   rol no puede leer la suscripción y decide el 403 de la API).
 * - `isLocked(error)`: bloqueado por el plan o por un 403 `module_not_in_plan` de la API.
 * Mientras la página está montada, el interceptor no muestra toast por ese 403: lo dice
 * `<ModuleLocked />`.
 */
export function useModuleGate(module: ModuleKey) {
  const { user, selectedCompanyId, role } = useAuthStore();
  const canReadSubscription = !!role && BILLING_ROLES.has(role) && !!selectedCompanyId;

  const { data: subscription, isError } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: canReadSubscription,
  });

  useEffect(() => expectModuleLock(module), [module]);

  // La API no le aplica el plan al super admin, tampoco dentro de la vista de su empresa (spec 029).
  const superAdmin = role === "super_admin" || user?.role === "super_admin";
  const lockedByPlan =
    !superAdmin && canReadSubscription && !!subscription && !subscription.active_modules.includes(module);
  // Sin rol todavía (primer render de hidratación: zustand da el estado inicial) no se consulta.
  const ready = superAdmin || (!!role && (!canReadSubscription || !!subscription || isError));

  return {
    enabled: ready && !lockedByPlan,
    isLocked: (error?: unknown) => !superAdmin && (lockedByPlan || moduleNotInPlan(error) === module),
  };
}

// true si el módulo no está en `active_modules` de la empresa o la API ya respondió 403
// `module_not_in_plan` para él. Mientras carga la suscripción no bloquea.
export function useModuleLocked(module: ModuleKey, error?: unknown): boolean {
  return useModuleGate(module).isLocked(error);
}

export function ModuleLocked({ module }: { module: ModuleKey }) {
  const t = useTranslations("subscription");
  const tm = useTranslations("modules");
  const locale = useLocale();
  const role = useAuthStore((s) => s.role);
  const canUpgrade = !!role && BILLING_ROLES.has(role);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-card shadow-etiqueta">
        <Lock size={22} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
      </div>
      <h2 className="font-display text-2xl font-extrabold uppercase leading-none text-foreground">
        {t("moduleLocked")}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {t("moduleLockedDesc", { module: tm(module) })}
      </p>
      {canUpgrade && (
        <Button asChild className="mt-6 gap-2">
          <Link href={`/${locale}/suscripcion`}>
            <Sparkles size={16} strokeWidth={1.75} aria-hidden />
            {t("upgradePlan")}
          </Link>
        </Button>
      )}
    </div>
  );
}
