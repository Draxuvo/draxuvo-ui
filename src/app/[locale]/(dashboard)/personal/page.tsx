// src/app/[locale]/(dashboard)/personal/page.tsx
// Personal (specs 029 y 036): las personas de la empresa y su asistencia en un solo lugar. Dos pestañas, Empleados
// (con el acceso de cada quien en su ficha) y Asistencia, según los módulos del plan. Manager las ve en lectura;
// staff lo bloquea proxy.ts.
"use client";
import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useAppRouter } from "@/hooks/use-router";
import { getSubscription } from "@/services/subscription";
import { EmployeesTab } from "@/components/people/employees-tab";
import { AttendanceTab } from "@/components/people/attendance-tab";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/types";

type Tab = "empleados" | "asistencia";
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

  const canSee = !!role && PEOPLE_ROLES.has(role);

  // Sin datos del plan se asumen ambos módulos (como el menú); con ellos, solo los incluidos.
  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: !!user && canSee && !!selectedCompanyId,
  });
  const inPlan = (module: ModuleKey) => !subscription || subscription.active_modules.includes(module);
  const available: Tab[] = [...(inPlan("employees") ? ["empleados" as const] : []), ...(inPlan("attendance") ? ["asistencia" as const] : [])];

  const asked = searchParams.get("tab");
  const active: Tab | undefined = available.find((tab) => tab === asked) ?? available[0];

  // Con rol que no entra aquí (staff) se va a su inicio. El super admin que sale de la vista de empresa va a donde
  // lo lleva su enlace ("Volver al panel global"): esta página no se lo cambia.
  useEffect(() => {
    if (role && role !== "super_admin" && !canSee) appRouter.replace(role === "staff" ? "/mis-ordenes" : "/inicio");
  }, [role, canSee, appRouter]);

  if (!canSee || !active) return null;

  function select(tab: Tab) {
    // Cambiar de pestaña empieza de cero: los filtros y la página son de cada lista.
    router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  }

  const tabs: { key: Tab; label: string }[] = available.map((key) => ({
    key,
    label: key === "empleados" ? t("tabs.employees") : t("tabs.attendance"),
  }));

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
        {active === "asistencia" ? <AttendanceTab /> : <EmployeesTab />}
      </div>
    </div>
  );
}
