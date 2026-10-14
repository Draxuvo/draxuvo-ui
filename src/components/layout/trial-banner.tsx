"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { differenceInDays } from "date-fns";
import { AlertTriangle, CreditCard, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import { cn } from "@/lib/utils";

const BANNER_EXEMPT = ["/suscripcion", "/perfil"];

export function TrialBanner() {
  const t = useTranslations("subscription");
  const locale = useLocale();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    retry: false,
    enabled: !!user && user.role !== "super_admin",
  });

  const bare = pathname.replace(/^\/(es|en)/, "") || "/";
  if (BANNER_EXEMPT.some((r) => bare.startsWith(r))) return null;
  if (!subscription) return null;

  const isTrial = subscription.status === "trialing";

  const daysLeft =
    isTrial && subscription.trial_ends_at
      ? Math.max(0, differenceInDays(new Date(subscription.trial_ends_at), new Date()))
      : null;

  const daysUntilRenewal =
    subscription.status === "active" && subscription.current_period_end
      ? Math.max(0, differenceInDays(new Date(subscription.current_period_end), new Date()))
      : null;

  const isExpired = subscription.status === "expired" || daysLeft === 0;

  if (subscription.status === "active" && daysUntilRenewal === null) return null;
  if (subscription.status === "active" && daysUntilRenewal !== null && daysUntilRenewal > 30) return null;

  if (subscription.status === "active" && daysUntilRenewal !== null) {
    return (
      <div className="flex items-center justify-between px-6 py-2 text-sm bg-blue-50 border-b border-blue-200 text-blue-800">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="shrink-0" />
          <span>
            <span className="font-semibold">{daysUntilRenewal}</span>{" "}
            {t("activeBannerDays")}
          </span>
        </div>
        {isSuperAdmin && (
          <Link
            href={`/${locale}/suscripcion`}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-md transition-colors bg-blue-100 hover:bg-blue-200 text-blue-800"
          >
            {t("activeBannerAction")}
          </Link>
        )}
      </div>
    );
  }

  if (!isTrial && subscription.status !== "expired") return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-2 text-sm",
        isExpired
          ? "bg-red-50 border-b border-red-200 text-red-800"
          : "bg-amber-50 border-b border-amber-200 text-amber-800",
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="shrink-0" />
        {isExpired ? (
          <span className="font-medium">{t("trialBannerExpired")}</span>
        ) : (
          <span>
            <span className="font-semibold">{daysLeft}</span>{" "}
            {t("trialBannerDays")}
          </span>
        )}
      </div>
      {isSuperAdmin && (
        <Link
          href={`/${locale}/suscripcion`}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-md transition-colors",
            isExpired
              ? "bg-red-100 hover:bg-red-200 text-red-800"
              : "bg-amber-100 hover:bg-amber-200 text-amber-800",
          )}
        >
          <CreditCard size={12} />
          {t("trialBannerAction")}
        </Link>
      )}
    </div>
  );
}
