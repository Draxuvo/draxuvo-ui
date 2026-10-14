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
    <div className="space-y-8">
      <section className="rounded-[6px] border border-border bg-card p-4 text-card-foreground shadow-etiqueta sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t("currentPlan")}
            </h2>
            {subscription && (
              <p className="mt-1 font-display text-[2.25rem] font-extrabold uppercase leading-none">
                {tp(subscription.plan)}
              </p>
            )}
          </div>
          {subscription && <StatusBadge subscription={subscription} />}
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-3" aria-busy>
            <div className="h-8 w-32 rounded-[6px] bg-muted motion-safe:animate-pulse" />
            <div className="h-16 rounded-[6px] bg-muted motion-safe:animate-pulse" />
          </div>
        ) : subscription ? (
          <div className="mt-4 space-y-4">
            {(subscription.billing_cycle ||
              (subscription.total_cents > 0 && status !== "trialing")) && (
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {subscription.billing_cycle && (
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("billingCycle")}</dt>
                    <dd className="text-base font-semibold">{tp(subscription.billing_cycle)}</dd>
                  </div>
                )}
                {subscription.total_cents > 0 && status !== "trialing" && (
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("totalWithIva")}</dt>
                    <dd className="font-display text-2xl font-semibold leading-tight tabular-nums">
                      {formatCents(subscription.total_cents)}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <StatusPanel subscription={subscription} formatDate={formatDate} />
          </div>
        ) : null}
      </section>

      {subscription && canPay && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-extrabold uppercase leading-none">
            {t("choosePlan")}
          </h2>
          <PlanPicker
            selected={plan}
            onSelect={handleSelectPlan}
            cycle={cycle}
            onCycleChange={setPickedCycle}
            currentPlan={subscription.plan}
            disabled={busy}
          />
          <Button
            onClick={handleCheckout}
            disabled={busy}
            className="h-11 w-full gap-2 rounded-[6px] px-5 text-base font-semibold focus-visible:ring-foreground/40 sm:w-auto"
          >
            <CreditCard size={20} strokeWidth={1.75} aria-hidden />
            {redirecting === "checkout" ? t("activating") : tp("payPlan", { plan: tp(plan) })}
          </Button>
        </section>
      )}

      {subscription && canManage && (
        <section className="rounded-[6px] border border-border bg-card p-4 text-card-foreground shadow-etiqueta sm:p-6">
          <h2 className="font-display text-2xl font-extrabold uppercase leading-none">
            {t("manage")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("manageDesc")}</p>
          <Button
            variant="outline"
            onClick={handlePortal}
            disabled={busy}
            className="mt-4 h-11 w-full gap-2 rounded-[6px] border-foreground bg-card px-5 text-base font-semibold hover:bg-background sm:w-auto"
          >
            <ExternalLink size={20} strokeWidth={1.75} aria-hidden />
            {redirecting === "portal" ? t("openingPortal") : t("manage")}
          </Button>
        </section>
      )}
    </div>
  );
}

const BADGE = "h-6 rounded-full border-transparent px-2.5 text-xs font-semibold";

function StatusBadge({ subscription }: { subscription: Subscription }) {
  const t = useTranslations("subscription");
  switch (subscription.status) {
    case "active":
      return subscription.cancel_at_period_end ? (
        <Badge className={cn(BADGE, "bg-ceja text-foreground")}>{t("statusCancelScheduled")}</Badge>
      ) : (
        <Badge className={cn(BADGE, "bg-sello text-etiqueta")}>{t("active")}</Badge>
      );
    case "trialing":
      return <Badge className={cn(BADGE, "bg-ceja text-foreground")}>{t("trialing")}</Badge>;
    case "past_due":
      return <Badge className={cn(BADGE, "bg-alerta text-etiqueta")}>{t("pastDue")}</Badge>;
    case "expired":
      return <Badge className={cn(BADGE, "bg-alerta text-etiqueta")}>{t("expired")}</Badge>;
    case "cancelled":
      return (
        <Badge className={cn(BADGE, "border-border bg-background text-foreground")}>
          {t("cancelled")}
        </Badge>
      );
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
        <Panel tone="ceja" icon={Clock} title={t("trialStatus")}>
          {daysLeft !== null && (
            <p className="font-display text-2xl font-semibold leading-tight tabular-nums">
              {t("trialDaysLeft", { days: daysLeft })}
            </p>
          )}
          {trialEnd && <p className="text-sm text-gris-texto">{t("trialUntil", { date: trialEnd })}</p>}
        </Panel>
      );
    }
    case "active":
      if (subscription.cancel_at_period_end) {
        return (
          <Panel
            tone="ceja"
            icon={CalendarDays}
            title={periodEnd ? t("cancelScheduled", { date: periodEnd }) : t("statusCancelScheduled")}
          >
            <p className="text-sm text-gris-texto">{t("cancelScheduledDesc")}</p>
          </Panel>
        );
      }
      return (
        <Panel tone="sello" icon={ShieldCheck} title={t("active")}>
          {periodEnd && (
            <p className="text-sm text-muted-foreground">{t("nextRenewal", { date: periodEnd })}</p>
          )}
        </Panel>
      );
    case "past_due":
      return (
        <Panel tone="alerta" icon={AlertTriangle} title={t("pastDue")}>
          <p className="text-sm text-muted-foreground">{t("pastDueBanner")}</p>
        </Panel>
      );
    case "expired":
      return (
        <Panel tone="alerta" icon={AlertTriangle} title={t("trialExpired")}>
          <p className="text-sm text-muted-foreground">{t("trialExpiredDesc")}</p>
        </Panel>
      );
    case "cancelled":
      return (
        <Panel tone="neutral" icon={Clock} title={t("cancelled")}>
          <p className="text-sm text-muted-foreground">{t("trialExpiredDesc")}</p>
        </Panel>
      );
  }
}

// Texto siempre en tinta o gris-texto; el color del estado va en el fondo y el icono.
const TONES = {
  ceja: { box: "border-ceja bg-ceja/25", icon: "text-foreground" },
  sello: { box: "border-sello/30 bg-sello/[0.06]", icon: "text-sello" },
  alerta: { box: "border-alerta/30 bg-alerta/[0.06]", icon: "text-alerta" },
  neutral: { box: "border-border bg-background", icon: "text-muted-foreground" },
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
    <div className={cn("flex items-start gap-3 rounded-[6px] border p-4", c.box)}>
      <Icon size={20} strokeWidth={1.75} className={cn("shrink-0", c.icon)} aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}
