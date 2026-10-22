"use client";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CreditCard } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { CompanySwitcher, useSwitchCompany } from "./company-switcher";
import { apiClient } from "@/lib/api";
import { getSubscription } from "@/services/subscription";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BILLING_ROLES = ["owner", "admin"];

// GET /subscription responde 403 a roles menores, así que para ellos se sondea
// GET /company (pasa por check_subscription!) sin disparar el toast global:
// un 403 ahí significa que la empresa no tiene acceso.
async function probeCompanyAccess(): Promise<{ access: boolean; suspended: boolean }> {
  const res = await apiClient.get("/api/v1/company", {
    validateStatus: (s) => s < 500,
  });
  const code = res.data?.error?.details?.code;
  return { access: res.status !== 403, suspended: code === "subscription_suspended" };
}

export function SubscriptionGuard() {
  const t = useTranslations("subscription");
  const tp = useTranslations("plans");
  const locale = useLocale();
  const pathname = usePathname();
  const { user, logout, selectedCompanyId, role } = useAuthStore();
  const switchCompany = useSwitchCompany();

  // También dentro de la vista de empresa: la API no le exige suscripción (spec 029).
  const isSuperAdmin = role === "super_admin" || user?.role === "super_admin";
  const canBill = !!role && BILLING_ROLES.includes(role);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: !!user && canBill,
  });

  const { data: memberAccess } = useQuery({
    queryKey: ["company-access", selectedCompanyId],
    queryFn: probeCompanyAccess,
    retry: false,
    enabled: !!user && !isSuperAdmin && !canBill,
  });

  if (!user || isSuperAdmin) return null;

  // Con varias empresas, una bloqueada no deja a nadie atrapado: puede cambiar a otra.
  const companies = user.companies ?? [];
  const switcher = companies.length > 1 ? <CompanySwitcher className="mr-auto" /> : null;

  if (canBill) {
    if (!subscription || subscription.active_access) return null;

    // El dueño y el admin pueden llegar a pagar con la prueba vencida.
    const bare = pathname.replace(/^\/(es|en)(?=\/|$)/, "") || "/";
    if (bare === "/suscripcion" || bare.startsWith("/suscripcion/")) return null;

    const suspended = subscription.status === "suspended";
    const title = suspended
      ? t("suspendedTitle")
      : subscription.status === "cancelled"
        ? t("blockedTitleExpired")
        : t("blockedTitle");

    // Sucursal: el pago se hace en la principal, no aquí.
    if (subscription.managed_by_parent) {
      const parentId = companies.find((c) => c.id === selectedCompanyId)?.parent_company_id;
      const parent = companies.find((c) => c.id === parentId);
      return (
        <BlockedDialog title={title} description={t("managedByParentDesc")}>
          <Button variant="outline" onClick={logout}>
            {t("logout")}
          </Button>
          {parent ? (
            <Button onClick={() => switchCompany(parent.id)}>
              {t("managedByParentAction", { company: parent.name })}
            </Button>
          ) : (
            switcher
          )}
        </BlockedDialog>
      );
    }

    return (
      <BlockedDialog title={title} description={suspended ? t("suspendedDescOwner") : t("blockedDescOwner")}>
        {suspended && (
          <p className="text-sm text-muted-foreground">
            {subscription.suspension_reason === "plan_change" ? t("suspendedReasonPlanChange") : t("suspendedReasonOverdue")}{" "}
            {t("suspendedPending", { plan: tp(subscription.plan) })}
          </p>
        )}
        {switcher}
        <Button variant="outline" onClick={logout}>
          {t("logout")}
        </Button>
        {suspended && subscription.pay_url ? (
          <Button asChild className="gap-2">
            <a href={subscription.pay_url} target="_blank" rel="noreferrer">
              <CreditCard size={14} />
              {t("payNow")}
            </a>
          </Button>
        ) : (
          <Button asChild className="gap-2">
            <Link href={`/${locale}/suscripcion`}>
              <CreditCard size={14} />
              {suspended ? t("payNow") : t("blockedAction")}
            </Link>
          </Button>
        )}
      </BlockedDialog>
    );
  }

  if (memberAccess?.access !== false) return null;

  return (
    <BlockedDialog
      title={memberAccess.suspended ? t("suspendedTitle") : t("blockedTitleExpired")}
      description={memberAccess.suspended ? t("suspendedDescMember") : t("blockedDescMember")}
    >
      {switcher}
      <Button variant="outline" onClick={logout}>
        {t("logout")}
      </Button>
    </BlockedDialog>
  );
}

function BlockedDialog({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open modal>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-alerta/10">
              <AlertTriangle size={20} strokeWidth={1.75} className="text-alerta" aria-hidden />
            </div>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">{children}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
