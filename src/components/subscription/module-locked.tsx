"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import type { ModuleKey } from "@/types";

// GET /subscription solo responde a owner y admin; los demás dependen del 403 de la API.
const BILLING_ROLES = new Set(["owner", "admin"]);

// Módulo de un 403 `module_not_in_plan` de la API, o null si el error es otro.
export function moduleNotInPlan(error: unknown): ModuleKey | null {
  if (!isAxiosError(error) || error.response?.status !== 403) return null;
  const details = error.response.data?.error?.details;
  return details?.code === "module_not_in_plan" ? (details.module as ModuleKey) : null;
}

// true si el módulo no está en `active_modules` de la empresa o la API ya respondió 403
// `module_not_in_plan` para él. Mientras carga la suscripción no bloquea.
export function useModuleLocked(module: ModuleKey, error?: unknown): boolean {
  const { selectedCompanyId, role } = useAuthStore();
  const canReadSubscription = !!role && BILLING_ROLES.has(role) && !!selectedCompanyId;

  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: canReadSubscription,
  });

  if (role === "super_admin") return false;
  if (moduleNotInPlan(error) === module) return true;
  return canReadSubscription && !!subscription && !subscription.active_modules.includes(module);
}

export function ModuleLocked({ module }: { module: ModuleKey }) {
  const t = useTranslations("subscription");
  const tm = useTranslations("modules");
  const locale = useLocale();
  const role = useAuthStore((s) => s.role);
  const canUpgrade = !!role && BILLING_ROLES.has(role);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
        <Lock size={22} className="text-zinc-500" />
      </div>
      <h2 className="text-base font-medium text-zinc-900">{t("moduleLocked")}</h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        {t("moduleLockedDesc", { module: tm(module) })}
      </p>
      {canUpgrade && (
        <Button asChild className="mt-6 gap-2">
          <Link href={`/${locale}/suscripcion`}>
            <Sparkles size={15} />
            {t("upgradePlan")}
          </Link>
        </Button>
      )}
    </div>
  );
}
