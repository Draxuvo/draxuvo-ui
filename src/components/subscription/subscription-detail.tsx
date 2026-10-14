"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { differenceInDays, format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { CreditCard, ShieldCheck, Clock, AlertTriangle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSubscription, createCheckout } from "@/services/subscription";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DATE_LOCALES = { es, en: enUS };

export function SubscriptionDetail() {
  const t = useTranslations("subscription");
  const locale = useLocale() as "es" | "en";
  const [loading, setLoading] = useState(false);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    retry: false,
  });

  const isTrial = subscription?.status === "trialing";

  const daysLeft =
    isTrial && subscription?.trial_ends_at
      ? Math.max(0, differenceInDays(new Date(subscription.trial_ends_at), new Date()))
      : null;

  const daysUntilRenewal =
    subscription?.status === "active" && subscription?.current_period_end
      ? Math.max(0, differenceInDays(new Date(subscription.current_period_end), new Date()))
      : null;

  const isExpired =
    subscription?.status === "expired" || (isTrial && daysLeft === 0);

  const trialEndFormatted =
    subscription?.trial_ends_at
      ? format(new Date(subscription.trial_ends_at), "d MMM yyyy", {
          locale: DATE_LOCALES[locale],
        })
      : null;

  const renewalDateFormatted =
    subscription?.current_period_end
      ? format(new Date(subscription.current_period_end), "d MMM yyyy", {
          locale: DATE_LOCALES[locale],
        })
      : null;

  async function handleCheckout() {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { checkout_url } = await createCheckout(
        subscription?.plan ?? "pro",
        subscription?.billing_cycle ?? "monthly",
        `${origin}/${locale}/suscripcion/exito`,
        `${origin}/${locale}/suscripcion/cancelado`,
      );
      window.location.href = checkout_url;
    } catch {
      toast.error(t("checkoutError"));
      setLoading(false);
    }
  }

  const planLabel = () => {
    if (!subscription?.plan) return t("noPlan");
    if (subscription.plan === "enterprise") return t("planEnterprise");
    return subscription.plan;
  };

  const statusBadge = () => {
    if (!subscription) return null;
    if (subscription.status === "active")
      return <Badge className="bg-green-100 text-green-800 border-green-200">{t("active")}</Badge>;
    if (isExpired)
      return <Badge variant="destructive">{t("expired")}</Badge>;
    if (isTrial)
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{t("trial")}</Badge>;
    if (subscription.status === "cancelled")
      return <Badge variant="secondary">{t("cancelled")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("currentPlan")}</CardTitle>
            {!isLoading && statusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-5 w-32 bg-zinc-100 animate-pulse rounded-md" />
              <div className="h-16 bg-zinc-100 animate-pulse rounded-md" />
            </div>
          ) : (
            <>
              {subscription?.plan && (
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <span className="font-medium text-zinc-500">{t("planLabel")}:</span>
                  <span className="font-semibold text-zinc-900">{planLabel()}</span>
                </div>
              )}

              {isTrial && (
                <div
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg",
                    isExpired ? "bg-red-50" : "bg-amber-50",
                  )}
                >
                  <AlertTriangle
                    size={16}
                    className={cn("mt-0.5 shrink-0", isExpired ? "text-red-600" : "text-amber-600")}
                  />
                  <div className="space-y-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isExpired ? "text-red-800" : "text-amber-800",
                      )}
                    >
                      {isExpired ? t("trialExpired") : t("trialStatus")}
                    </p>
                    {!isExpired && daysLeft !== null && (
                      <p className="text-sm font-semibold text-amber-900">
                        {t("trialDaysLeft", { days: daysLeft })}
                      </p>
                    )}
                    {!isExpired && trialEndFormatted && (
                      <p className="text-xs text-amber-700">
                        {t("trialUntil", { date: trialEndFormatted })}
                      </p>
                    )}
                    {isExpired && (
                      <p className="text-xs text-red-700">{t("trialExpiredDesc")}</p>
                    )}
                  </div>
                </div>
              )}

              {subscription?.status === "active" && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50">
                  <ShieldCheck size={16} className="text-green-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-800">{t("active")}</p>
                    {renewalDateFormatted && (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={12} className="text-green-600" />
                        <p className="text-xs text-green-700">
                          {t("renewsOn", { date: renewalDateFormatted })}
                        </p>
                      </div>
                    )}
                    {daysUntilRenewal !== null && (
                      <p className="text-sm font-semibold text-green-900">
                        {t("daysUntilRenewal", { days: daysUntilRenewal })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {subscription?.status === "cancelled" && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-zinc-100">
                  <Clock size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-zinc-600">{t("cancelled")}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {(!subscription || subscription.status !== "active") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("businessPlan")}</CardTitle>
            <CardDescription>{t("businessDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <CreditCard size={16} className="mr-2" />
              {loading ? t("activating") : t("upgradeBusiness")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
