"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { differenceInDays, format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { AlertTriangle, CreditCard, CalendarDays } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { createPortal, getSubscription } from "@/services/subscription";
import { cn } from "@/lib/utils";

const BANNER_EXEMPT = ["/suscripcion", "/perfil"];
const BILLING_ROLES = ["owner", "admin"];

export function TrialBanner() {
  const t = useTranslations("subscription");
  const locale = useLocale();
  const pathname = usePathname();
  const { user, selectedCompanyId, role } = useAuthStore();
  // El super admin no paga, tampoco dentro de la vista de su empresa (spec 029).
  const canBill = !!role && BILLING_ROLES.includes(role) && user?.role !== "super_admin";
  const [openingPortal, setOpeningPortal] = useState(false);

  // GET /subscription solo responde a owner, admin y super_admin; el banner no aplica al super admin.
  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: canBill,
  });

  const bare = pathname.replace(/^\/(es|en)(?=\/|$)/, "") || "/";
  if (BANNER_EXEMPT.some((r) => bare.startsWith(r))) return null;
  if (!canBill || !subscription) return null;
  // Una demo (spec 039) tiene su propio aviso y no tiene renovación ni prueba que contar.
  if (subscription.demo) return null;
  // En una sucursal el cobro se administra en la principal: el aviso queda, sin acciones de pago.
  const managedByParent = !!subscription.managed_by_parent;

  async function handleUpdateCard() {
    setOpeningPortal(true);
    try {
      const { portal_url } = await createPortal(
        `${window.location.origin}/${locale}/suscripcion`,
      );
      window.location.href = portal_url;
    } catch {
      toast.error(t("portalError"));
      setOpeningPortal(false);
    }
  }

  if (subscription.status === "past_due") {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-alerta/30 bg-alerta/10 px-4 py-2 text-sm text-foreground sm:px-6">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0 text-alerta" aria-hidden="true" />
          <span className="font-medium">
            {subscription.grace_ends_at
              ? t("pastDueGraceBanner", { date: format(new Date(subscription.grace_ends_at), "d MMM yyyy", { locale: locale === "en" ? enUS : es }) })
              : t("pastDueBanner")}
          </span>
        </div>
        {!managedByParent && (
          <button
            type="button"
            onClick={handleUpdateCard}
            disabled={openingPortal}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors duration-[120ms] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
          >
            <CreditCard size={12} />
            {openingPortal ? t("openingPortal") : t("pastDueAction")}
          </button>
        )}
      </div>
    );
  }

  if (subscription.status === "active") {
    if (managedByParent || subscription.cancel_at_period_end || !subscription.current_period_end) return null;
    const daysUntilRenewal = Math.max(
      0,
      differenceInDays(new Date(subscription.current_period_end), new Date()),
    );
    if (daysUntilRenewal > 30) return null;

    return (
      <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-2 text-sm text-muted-foreground sm:px-6">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
          <span>
            <span className="font-display text-base font-semibold tabular-nums text-foreground">{daysUntilRenewal}</span> {t("activeBannerDays")}
          </span>
        </div>
        <Link
          href={`/${locale}/suscripcion`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors duration-[120ms] hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("activeBannerAction")}
        </Link>
      </div>
    );
  }

  if (subscription.status !== "trialing" && subscription.status !== "expired") return null;

  const daysLeft =
    subscription.status === "trialing" && subscription.trial_ends_at
      ? Math.max(0, differenceInDays(new Date(subscription.trial_ends_at), new Date()))
      : null;
  const isExpired = subscription.status === "expired" || !subscription.active_access;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2 text-sm text-foreground sm:px-6",
        isExpired
          ? "border-b border-alerta/30 bg-alerta/10"
          : "border-b border-tinta/10 bg-ceja",
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className={cn("shrink-0", isExpired && "text-alerta")} aria-hidden="true" />
        {isExpired ? (
          <span className="font-medium">{t("trialBannerExpired")}</span>
        ) : (
          <span>
            <span className="font-display text-base font-semibold tabular-nums">{daysLeft}</span> {t("trialBannerDays")}
          </span>
        )}
      </div>
      {!managedByParent && (
        <Link
          href={`/${locale}/suscripcion`}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors duration-[120ms] hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <CreditCard size={12} />
          {t("trialBannerAction")}
        </Link>
      )}
    </div>
  );
}
