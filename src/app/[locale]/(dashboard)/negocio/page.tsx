// src/app/[locale]/(dashboard)/negocio/page.tsx
// Mi negocio (spec 063): datos de la empresa activa que maneja el dueño o el administrador. Por ahora, su logo, que
// reemplaza a la marca Draxuvo en el panel, la app, los tickets y el menú QR.
"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { LogoCard } from "@/components/business/logo-card";
import { useAppRouter } from "@/hooks/use-router";
import { useAuthStore } from "@/store/auth";

const BOSS_ROLES = new Set(["admin", "owner", "super_admin"]);

export default function NegocioPage() {
  const t = useTranslations("business");
  const router = useAppRouter();
  const { user, role, selectedCompanyId } = useAuthStore();
  const canManage = !!role && BOSS_ROLES.has(role);
  const company = user?.companies?.find((c) => c.id === selectedCompanyId) ?? user?.companies?.[0];

  // El personal no administra la empresa (proxy.ts ya lo bloquea; la API también).
  useEffect(() => {
    if (role && !canManage) router.replace("/mis-ordenes");
  }, [role, canManage, router]);

  if (!canManage || !company) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-[0.01em] text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description", { name: company.name })}</p>
      </div>
      <LogoCard companyName={company.name} logoUrl={company.logo_url} />
    </div>
  );
}
