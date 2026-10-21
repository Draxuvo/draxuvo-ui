// src/app/[locale]/(dashboard)/personal/page.tsx
// Personal (spec 028): las personas de la empresa en un solo lugar. "Empleados" es lo que antes era
// Personal y "Acceso" lo que era Equipo. Manager solo ve Empleados; staff lo bloquea proxy.ts.
"use client";
import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useAppRouter } from "@/hooks/use-router";
import { getSubscription } from "@/services/subscription";
import { EmployeesTab } from "@/components/people/employees-tab";
import { AccessTab } from "@/components/people/access-tab";
import { cn } from "@/lib/utils";

type Tab = "empleados" | "acceso";
const ACCESS_ROLES = new Set(["admin", "owner"]);
const PEOPLE_ROLES = new Set(["admin", "owner", "manager"]);

export default function PersonalPage() {
  return (
    <Suspense>
      <PersonalContent />
    </Suspense>
  );
}

function PersonalContent() {
  const t = useTranslations("people");
  const router = useRouter();
  const appRouter = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, role, selectedCompanyId } = useAuthStore();

  const canAccess = !!role && ACCESS_ROLES.has(role);
  const canSee = !!role && PEOPLE_ROLES.has(role);

  // Sin el módulo de empleados en el plan, la pestaña que abre es Acceso.
  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: !!user && canAccess && !!selectedCompanyId,
  });
  const employeesInPlan = !subscription || subscription.active_modules.includes("employees");
  const fallback: Tab = canAccess && !employeesInPlan ? "acceso" : "empleados";

  const asked = searchParams.get("tab");
  const active: Tab = asked === "acceso" && canAccess ? "acceso" : asked === "empleados" ? "empleados" : fallback;

  // Con rol que no entra aquí (super admin sin vista de empresa, staff) se va a su inicio.
  useEffect(() => {
    if (role && !canSee) appRouter.replace(role === "staff" ? "/mis-ordenes" : "/inicio");
  }, [role, canSee, appRouter]);

  if (!canSee) return null;

  function select(tab: Tab) {
    // Cambiar de pestaña empieza de cero: los filtros y la página son de cada lista.
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "empleados", label: t("tabs.employees") },
    ...(canAccess ? [{ key: "acceso" as const, label: t("tabs.access") }] : []),
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{t("title")}</h1>

      {tabs.length > 1 && (
        <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`personal-tab-${tab.key}`}
              aria-selected={active === tab.key}
              aria-controls={`personal-panel-${tab.key}`}
              tabIndex={active === tab.key ? 0 : -1}
              onClick={() => select(tab.key)}
              className={cn(
                "-mb-px h-11 border-b-2 px-4 text-sm font-medium transition-colors duration-[120ms] foco-etiqueta",
                active === tab.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div role="tabpanel" id={`personal-panel-${active}`} aria-labelledby={`personal-tab-${active}`}>
        {active === "acceso" ? <AccessTab /> : <EmployeesTab />}
      </div>
    </div>
  );
}
