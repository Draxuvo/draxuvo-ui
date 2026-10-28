// src/app/[locale]/(dashboard)/alertas/page.tsx
// Alertas operativas (spec 045): lo que piden atención ahora y la configuración de sus tiempos y canales.
// Solo dueño y administrador (staff ya lo bloquea proxy.ts; la API también responde 403).
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertList } from "@/components/alerts/alert-list";
import { AlertSettingsForm } from "@/components/alerts/alert-settings";
import { MyNotifications } from "@/components/alerts/my-notifications";
import { useCanSeeAlerts } from "@/hooks/use-alerts";
import { useAppRouter } from "@/hooks/use-router";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

type Tab = "active" | "settings";
const TABS: Tab[] = ["active", "settings"];

export default function AlertasPage() {
  const t = useTranslations("alerts");
  const router = useAppRouter();
  const role = useAuthStore((s) => s.role);
  const allowed = useCanSeeAlerts();
  const [tab, setTab] = useState<Tab>("active");

  useEffect(() => {
    if (role && !allowed) router.replace(role === "staff" ? "/mis-ordenes" : "/inicio");
  }, [role, allowed, router]);

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-medium text-foreground">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div role="tablist" aria-label={t("title")} className="flex gap-1 border-b border-border">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`alerts-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`alerts-panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "foco-etiqueta min-h-11 border-b-2 px-4 text-sm font-medium transition-colors duration-[120ms]",
              tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`alerts-panel-${tab}`} aria-labelledby={`alerts-tab-${tab}`} className="space-y-6">
        {tab === "active" ? (
          <AlertList />
        ) : (
          <>
            <AlertSettingsForm />
            <MyNotifications />
          </>
        )}
      </div>
    </div>
  );
}
