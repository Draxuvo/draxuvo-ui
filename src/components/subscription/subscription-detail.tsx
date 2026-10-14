"use client";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { differenceInDays, format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlanPicker, formatCents } from "@/components/subscription/plan-picker";
import { useAuthStore } from "@/store/auth";
import {
  createCheckout,
  createPortal,
  getSubscription,
  updateTrialPlan,
} from "@/services/subscription";
import { cn } from "@/lib/utils";
import type { BillingCycle, PlanKey, Subscription } from "@/types";

const DATE_LOCALES = { es, en: enUS };

export function SubscriptionDetail() {
  const t = useTranslations("subscription");
  const tp = useTranslations("plans");
  const locale = useLocale() as "es" | "en";
  const queryClient = useQueryClient();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const queryKey = ["subscription", companyId];

  const [pickedPlan, setPickedPlan] = useState<PlanKey | null>(null);
  const [pickedCycle, setPickedCycle] = useState<BillingCycle | null>(null);
  const [redirecting, setRedirecting] = useState<"checkout" | "portal" | null>(null);

  const { data: subscription, isLoading } = useQuery({
    queryKey,
    queryFn: getSubscription,
    retry: false,
  });

  const changePlan = useMutation({
    mutationFn: updateTrialPlan,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("planChanged"));
    },
    onError: () => {
      setPickedPlan(null);
      toast.error(t("planChangeError"));
    },
  });

  const status = subscription?.status;
  const plan: PlanKey = pickedPlan ?? subscription?.plan ?? "pro";
  const cycle: BillingCycle = pickedCycle ?? subscription?.billing_cycle ?? "monthly";
  const canPay = status === "trialing" || status === "expired" || status === "cancelled";
  const canManage = status === "active" || status === "past_due";
  const busy = redirecting !== null || changePlan.isPending;

  const formatDate = (iso?: string | null) =>
    iso ? format(new Date(iso), "d MMM yyyy", { locale: DATE_LOCALES[locale] }) : null;

  function handleSelectPlan(next: PlanKey) {
    setPickedPlan(next);
    if (status === "trialing" && next !== subscription?.plan) changePlan.mutate(next);
  }

  async function handleCheckout() {
    setRedirecting("checkout");
    try {
      const origin = window.location.origin;
      const { checkout_url } = await createCheckout(
        plan,
        cycle,
        `${origin}/${locale}/suscripcion/exito`,
        `${origin}/${locale}/suscripcion/cancelado`,
      );
      window.location.href = checkout_url;
    } catch {
      toast.error(t("checkoutError"));
      setRedirecting(null);
    }
  }

  async function handlePortal() {
    setRedirecting("portal");
    try {
      const { portal_url } = await createPortal(
        `${window.location.origin}/${locale}/suscripcion`,
      );
      window.location.href = portal_url;
    } catch {
      toast.error(t("portalError"));
      setRedirecting(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("currentPlan")}</CardTitle>
            {subscription && <StatusBadge subscription={subscription} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-5 w-32 animate-pulse rounded-md bg-zinc-100" />
              <div className="h-16 animate-pulse rounded-md bg-zinc-100" />
            </div>
          ) : subscription ? (
            <>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="font-medium text-zinc-500">{t("planLabel")}:</dt>
                  <dd className="font-semibold text-zinc-900">{tp(subscription.plan)}</dd>
                </div>
                {subscription.billing_cycle && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-zinc-500">{t("billingCycle")}:</dt>
                    <dd className="text-zinc-900">{tp(subscription.billing_cycle)}</dd>
                  </div>
                )}
                {subscription.total_cents > 0 && status !== "trialing" && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-zinc-500">{t("totalWithIva")}:</dt>
                    <dd className="text-zinc-900">{formatCents(subscription.total_cents)}</dd>
                  </div>
                )}
              </dl>

              <StatusPanel subscription={subscription} formatDate={formatDate} />
            </>
          ) : null}
        </CardContent>
      </Card>

      {subscription && (canPay || canManage) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {canPay ? t("choosePlan") : t("manage")}
            </CardTitle>
            {canManage && <CardDescription>{t("manageDesc")}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {canPay && (
              <>
                <PlanPicker
                  selected={plan}
                  onSelect={handleSelectPlan}
                  cycle={cycle}
                  onCycleChange={setPickedCycle}
                  currentPlan={subscription.plan}
                  disabled={busy}
                />
                <Button onClick={handleCheckout} disabled={busy} className="w-full gap-2 sm:w-auto">
                  <CreditCard size={16} />
                  {redirecting === "checkout"
                    ? t("activating")
                    : tp("payPlan", { plan: tp(plan) })}
                </Button>
              </>
            )}

            {canManage && (
              <Button
                variant="outline"
                onClick={handlePortal}
                disabled={busy}
                className="w-full gap-2 sm:w-auto"
              >
                <ExternalLink size={16} />
                {redirecting === "portal" ? t("openingPortal") : t("manage")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ subscription }: { subscription: Subscription }) {
  const t = useTranslations("subscription");
  switch (subscription.status) {
    case "active":
      return subscription.cancel_at_period_end ? (
        <Badge className="border-amber-200 bg-amber-100 text-amber-800">
          {t("statusCancelScheduled")}
        </Badge>
      ) : (
        <Badge className="border-green-200 bg-green-100 text-green-800">{t("active")}</Badge>
      );
    case "trialing":
      return (
        <Badge className="border-amber-200 bg-amber-100 text-amber-800">{t("trialing")}</Badge>
      );
    case "past_due":
      return <Badge variant="destructive">{t("pastDue")}</Badge>;
    case "expired":
      return <Badge variant="destructive">{t("expired")}</Badge>;
    case "cancelled":
      return <Badge variant="secondary">{t("cancelled")}</Badge>;
  }
}

function StatusPanel({
  subscription,
  formatDate,
}: {
  subscription: Subscription;
  formatDate: (iso?: string | null) => string | null;
}) {
  const t = useTranslations("subscription");
  const periodEnd = formatDate(subscription.current_period_end);

  switch (subscription.status) {
    case "trialing": {
      const daysLeft =
        subscription.trial_days_remaining ??
        (subscription.trial_ends_at
          ? Math.max(0, differenceInDays(new Date(subscription.trial_ends_at), new Date()))
          : null);
      const trialEnd = formatDate(subscription.trial_ends_at);
      return (
        <Panel tone="amber" icon={Clock} title={t("trialStatus")}>
          {daysLeft !== null && (
            <p className="text-sm font-semibold text-amber-900">
              {t("trialDaysLeft", { days: daysLeft })}
            </p>
          )}
          {trialEnd && <p className="text-xs text-amber-700">{t("trialUntil", { date: trialEnd })}</p>}
        </Panel>
      );
    }
    case "active":
      if (subscription.cancel_at_period_end) {
        return (
          <Panel
            tone="amber"
            icon={CalendarDays}
            title={periodEnd ? t("cancelScheduled", { date: periodEnd }) : t("statusCancelScheduled")}
          >
            <p className="text-xs text-amber-700">{t("cancelScheduledDesc")}</p>
          </Panel>
        );
      }
      return (
        <Panel tone="green" icon={ShieldCheck} title={t("active")}>
          {periodEnd && (
            <p className="text-xs text-green-700">{t("nextRenewal", { date: periodEnd })}</p>
          )}
        </Panel>
      );
    case "past_due":
      return (
        <Panel tone="red" icon={AlertTriangle} title={t("pastDue")}>
          <p className="text-xs text-red-700">{t("pastDueBanner")}</p>
        </Panel>
      );
    case "expired":
      return (
        <Panel tone="red" icon={AlertTriangle} title={t("trialExpired")}>
          <p className="text-xs text-red-700">{t("trialExpiredDesc")}</p>
        </Panel>
      );
    case "cancelled":
      return (
        <Panel tone="zinc" icon={Clock} title={t("cancelled")}>
          <p className="text-xs text-zinc-600">{t("trialExpiredDesc")}</p>
        </Panel>
      );
  }
}

const TONES = {
  amber: { box: "bg-amber-50", icon: "text-amber-600", title: "text-amber-800" },
  green: { box: "bg-green-50", icon: "text-green-600", title: "text-green-800" },
  red: { box: "bg-red-50", icon: "text-red-600", title: "text-red-800" },
  zinc: { box: "bg-zinc-100", icon: "text-zinc-500", title: "text-zinc-700" },
};

function Panel({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  icon: typeof Clock;
  title: string;
  children?: ReactNode;
}) {
  const c = TONES[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg p-4", c.box)}>
      <Icon size={16} className={cn("mt-0.5 shrink-0", c.icon)} />
      <div className="space-y-1">
        <p className={cn("text-sm font-medium", c.title)}>{title}</p>
        {children}
      </div>
    </div>
  );
}
