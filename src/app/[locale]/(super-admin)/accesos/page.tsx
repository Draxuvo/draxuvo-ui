// src/app/[locale]/(super-admin)/accesos/page.tsx
// Accesos (spec 073): bitácora de inicios de sesión de toda la plataforma. Solo super admin.
"use client";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessLog } from "@/components/login-attempts/access-log";
import { useAuthStore } from "@/store/auth";

export default function AccesosPage() {
  const t = useTranslations("accessLog");
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
      {user ? (
        <Suspense fallback={<Skeleton className="h-64 w-full" aria-busy="true" />}>
          <AccessLog />
        </Suspense>
      ) : (
        <Skeleton className="h-64 w-full" aria-busy="true" />
      )}
    </div>
  );
}
