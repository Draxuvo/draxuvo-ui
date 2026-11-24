// src/app/[locale]/(super-admin)/estado/page.tsx
// Estado del sistema (spec 073): API, base de datos, trabajos, Better Stack y Sentry en una sola pantalla. Solo super admin.
"use client";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { SystemStatus } from "@/components/system-status/system-status";
import { useAuthStore } from "@/store/auth";

export default function EstadoPage() {
  const t = useTranslations("systemStatus");
  const user = useAuthStore((s) => s.user);
  // La API ya responde 403 a cualquier otro rol; aquí ni siquiera se consulta.
  const forbidden = !!user && user.role !== "super_admin";

  if (forbidden) {
    return (
      <div role="alert" className="rounded-etiqueta border border-border bg-card p-6">
        <h1 className="font-display text-2xl font-semibold">{t("forbidden.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("forbidden.body")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl leading-tight font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {user ? <SystemStatus /> : <Skeleton className="h-96 w-full" aria-busy="true" />}
    </div>
  );
}
