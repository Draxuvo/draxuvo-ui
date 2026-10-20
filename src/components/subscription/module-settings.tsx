"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import { cn } from "@/lib/utils";

const VIEW_ROLES = new Set(["owner", "admin"]);

// Módulos del plan con su estado, en solo lectura (spec 017): los activa y desactiva el super admin, no el negocio.
// Solo se listan los módulos que el plan incluye.
export function ModuleSettings() {
  const t = useTranslations("subscription");
  const tm = useTranslations("modules");
  const { selectedCompanyId, role } = useAuthStore();
  const canView = !!role && VIEW_ROLES.has(role);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: canView,
  });

  if (!canView || !subscription) return null;

  return (
    <section className="mt-8 rounded-etiqueta border border-border bg-card p-4 text-card-foreground shadow-etiqueta sm:p-6">
      <h2 className="font-display text-2xl font-extrabold uppercase leading-none">
        {t("modulesTitle")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("modulesReadOnly")}</p>
      <ul className="mt-4 divide-y divide-border">
        {subscription.available_modules.map((module) => {
          const on = subscription.active_modules.includes(module);
          return (
            <li key={module} className="flex min-h-14 items-center justify-between gap-4 py-3">
              <p className="text-sm font-semibold text-foreground">{tm(module)}</p>
              <p className={cn("text-sm font-medium", on ? "text-sello" : "text-muted-foreground")}>
                {on ? t("moduleOn") : t("moduleOff")}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
