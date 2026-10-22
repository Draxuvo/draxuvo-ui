// src/app/[locale]/(dashboard)/restaurante/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ConciergeBell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { ServiceView } from "@/components/restaurant/service-view";
import { SettingsTab } from "@/components/restaurant/settings-tab";
import { useScreenMode } from "@/components/take-order/use-screen-mode";
import { useStations } from "@/hooks/use-restaurant";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

type Tab = "service" | "settings";

export default function RestaurantePage() {
  const t = useTranslations("restaurant");
  const locale = useLocale();
  const role = useAuthStore((s) => s.role);
  const gate = useModuleGate("restaurant");
  // Tomar pedido vive aquí (spec 019); solo aplica con mesas dadas de alta.
  const takeOrder = useScreenMode();
  const stations = useStations({ enabled: gate.enabled });
  const [tab, setTab] = useState<Tab>("service");

  if (gate.isLocked(stations.error)) return <ModuleLocked module="restaurant" />;

  // Configuración es de dueño y administrador (spec 032); el gerente solo ve el servicio.
  const canConfigure = role === "owner" || role === "admin" || role === "super_admin";
  const current: Tab = canConfigure ? tab : "service";
  const tabs: { key: Tab; label: string }[] = [
    { key: "service", label: t("tabService") },
    { key: "settings", label: t("tabSettings") },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {takeOrder.ready && takeOrder.mode === "restaurant" && (
          <Button asChild className="min-h-11 gap-2">
            <Link href={`/${locale}/pedido?from=restaurante`} title={t("takeOrderHint")}>
              <ConciergeBell size={18} aria-hidden />
              {t("takeOrder")}
            </Link>
          </Button>
        )}
      </header>

      {canConfigure && (
        <div role="tablist" aria-label={t("title")} className="flex gap-2">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`restaurant-tab-${key}`}
              aria-selected={current === key}
              aria-controls={`restaurant-panel-${key}`}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-etiqueta border px-4 py-2 text-sm font-semibold foco-etiqueta transition-colors",
                current === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div role="tabpanel" id={`restaurant-panel-${current}`} aria-labelledby={canConfigure ? `restaurant-tab-${current}` : undefined}>
        {current === "service" ? (
          <ServiceView enabled={gate.enabled} onConfigure={canConfigure ? () => setTab("settings") : undefined} />
        ) : (
          <SettingsTab enabled={gate.enabled} />
        )}
      </div>
    </div>
  );
}
