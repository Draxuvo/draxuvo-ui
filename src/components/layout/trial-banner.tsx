"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { differenceInDays } from "date-fns";
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
  const { user, selectedCompanyId } = useAuthStore();
  const canBill = !!user && BILLING_ROLES.includes(user.role);
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
      <div className="flex items-center justify-between gap-4 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-800">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="font-medium">{t("pastDueBanner")}</span>
        </div>
        <button
          type="button"
          onClick={handleUpdateCard}
          disabled={openingPortal}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-800 transition-colors hover:bg-red-200 disabled:opacity-60"
        >
          <CreditCard size={12} />
          {openingPortal ? t("openingPortal") : t("pastDueAction")}
        </button>
      </div>
    );
  }

  if (subscription.status === "active") {
    if (subscription.cancel_at_period_end || !subscription.current_period_end) return null;
    const daysUntilRenewal = Math.max(
      0,
      differenceInDays(new Date(subscription.current_period_end), new Date()),
    );
    if (daysUntilRenewal > 30) return null;

    return (
      <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-6 py-2 text-sm text-blue-800">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="shrink-0" />
          <span>
            <span className="font-semibold">{daysUntilRenewal}</span> {t("activeBannerDays")}
          </span>
        </div>
        <Link
          href={`/${locale}/suscripcion`}
          className="flex items-center gap-1.5 rounded-md bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200"
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
        "flex items-center justify-between px-6 py-2 text-sm",
        isExpired
          ? "border-b border-red-200 bg-red-50 text-red-800"
          : "border-b border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="shrink-0" />
        {isExpired ? (
          <span className="font-medium">{t("trialBannerExpired")}</span>
        ) : (
          <span>
            <span className="font-semibold">{daysLeft}</span> {t("trialBannerDays")}
          </span>
        )}
      </div>
      <Link
        href={`/${locale}/suscripcion`}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
          isExpired
            ? "bg-red-100 text-red-800 hover:bg-red-200"
            : "bg-amber-100 text-amber-800 hover:bg-amber-200",
        )}
      >
        <CreditCard size={12} />
        {t("trialBannerAction")}
      </Link>
    </div>
  );
}
