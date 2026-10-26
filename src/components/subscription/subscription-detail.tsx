"use client";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { differenceInDays, format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Building2,
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
} from "@/services/subscription";
import { useSwitchCompany } from "@/components/layout/company-switcher";
import { cn } from "@/lib/utils";
import type { BillingCycle, PlanKey, Subscription } from "@/types";

const DATE_LOCALES = { es, en: enUS };

export function SubscriptionDetail() {
  const t = useTranslations("subscription");
  const tp = useTranslations("plans");
  const td = useTranslations("demo");
  const locale = useLocale() as "es" | "en";
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const companies = useAuthStore((s) => s.user?.companies);
  const switchCompany = useSwitchCompany();
  const queryKey = ["subscription", companyId];

  const [pickedPlan, setPickedPlan] = useState<PlanKey | null>(null);
  const [pickedCycle, setPickedCycle] = useState<BillingCycle | null>(null);
  const [redirecting, setRedirecting] = useState<"checkout" | "portal" | null>(null);

  const { data: subscription, isLoading } = useQuery({
    queryKey,
    queryFn: getSubscription,
    retry: false,
  });

  const status = subscription?.status;
  const plan: PlanKey = pickedPlan ?? subscription?.plan ?? "pro";
  const cycle: BillingCycle = pickedCycle ?? subscription?.billing_cycle ?? "monthly";
  // Sucursal (R17): la suscripción es la de la principal y el cobro se hace allá.
  const managedByParent = !!subscription?.managed_by_parent;
  // Demo (spec 039): la pantalla es informativa; no hay pagos ni cambios de plan.
  const isDemo = !!subscription?.demo;
  const parentId = companies?.find((c) => c.id === companyId)?.parent_company_id;
  const parent = companies?.find((c) => c.id === parentId);
  const canPay =
    !managedByParent && !isDemo && (status === "trialing" || status === "expired" || status === "cancelled");
  const canManage = !managedByParent && !isDemo && (status === "active" || status === "past_due" || status === "suspended");
  const busy = redirecting !== null;
  // Durante la prueba el plan solo lo cambia el super admin (spec 031): se puede pagar el plan asignado.
  const trialLockedPlan = status === "trialing" ? subscription?.plan ?? null : null;

  const formatDate = (iso?: string | null) =>
    iso ? format(new Date(iso), "d MMM yyyy", { locale: DATE_LOCALES[locale] }) : null;

  function handleSelectPlan(next: PlanKey) {
    setPickedPlan(next);
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
      <section className="rounded-etiqueta border border-border bg-card p-4 text-card-foreground shadow-etiqueta sm:p-6">
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
            <div className="h-8 w-32 rounded-etiqueta bg-muted motion-safe:animate-pulse" />
            <div className="h-16 rounded-etiqueta bg-muted motion-safe:animate-pulse" />
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

            {isDemo && (
              <p role="note" className="rounded-etiqueta border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                {td("subscriptionNotice")}
              </p>
            )}

            {managedByParent && (
              <Panel
                tone="neutral"
                icon={Building2}
                title={t("managedByParentTitle", { company: parent?.name ?? t("mainCompany") })}
              >
                <p className="text-sm text-muted-foreground">{t("managedByParentDesc")}</p>
                {parent && (
                  <Button
                    variant="outline"
                    onClick={() => switchCompany(parent.id)}
                    className="mt-3 h-11 gap-2 rounded-etiqueta border-foreground bg-card px-4 text-sm font-semibold hover:bg-background"
                  >
                    <Building2 size={18} strokeWidth={1.75} aria-hidden />
                    {t("managedByParentAction", { company: parent.name })}
                  </Button>
                )}
              </Panel>
            )}
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
            lockedPlan={trialLockedPlan}
          />
          {trialLockedPlan && (
            <p className="text-sm text-muted-foreground">{t("trialPlanLocked")}</p>
          )}
          <Button
            onClick={handleCheckout}
            disabled={busy}
            className="h-11 w-full gap-2 rounded-etiqueta px-5 text-base font-semibold sm:w-auto"
          >
            <CreditCard size={20} strokeWidth={1.75} aria-hidden />
            {redirecting === "checkout" ? t("activating") : tp("payPlan", { plan: tp(plan) })}
          </Button>
        </section>
      )}

      {subscription && canManage && (
        <section className="rounded-etiqueta border border-border bg-card p-4 text-card-foreground shadow-etiqueta sm:p-6">
          <h2 className="font-display text-2xl font-extrabold uppercase leading-none">
            {t("manage")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("manageDesc")}</p>
          <Button
            variant="outline"
            onClick={handlePortal}
            disabled={busy}
            className="mt-4 h-11 w-full gap-2 rounded-etiqueta border-foreground bg-card px-5 text-base font-semibold hover:bg-background sm:w-auto"
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
    case "suspended":
      return <Badge className={cn(BADGE, "bg-alerta text-etiqueta")}>{t("suspendedTitle")}</Badge>;
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
  const tp = useTranslations("plans");
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
    case "past_due": {
      const graceEnd = formatDate(subscription.grace_ends_at);
      return (
        <Panel tone="alerta" icon={AlertTriangle} title={t("pastDue")}>
          <p className="text-sm text-muted-foreground">{t("pastDueBanner")}</p>
          {graceEnd && <p className="text-sm font-medium text-foreground">{t("pastDueGrace", { date: graceEnd })}</p>}
        </Panel>
      );
    }
    case "suspended": {
      const cancelsOn = formatDate(subscription.cancels_at);
      return (
        <Panel tone="alerta" icon={AlertTriangle} title={t("suspendedTitle")}>
          <p className="text-sm text-muted-foreground">{t("suspendedDescOwner")}</p>
          <p className="text-sm text-muted-foreground">
            {subscription.suspension_reason === "plan_change" ? t("suspendedReasonPlanChange") : t("suspendedReasonOverdue")}
          </p>
          <p className="text-sm font-medium text-foreground">{t("suspendedPending", { plan: tp(subscription.plan) })}</p>
          {cancelsOn && <p className="text-sm text-muted-foreground">{t("suspendedCancelsOn", { date: cancelsOn })}</p>}
          {subscription.pay_url && (
            <Button asChild className="mt-2 h-11 gap-2 rounded-etiqueta px-5 text-base font-semibold">
              <a href={subscription.pay_url} target="_blank" rel="noreferrer">
                <CreditCard size={18} aria-hidden />
                {t("payNow")}
              </a>
            </Button>
          )}
        </Panel>
      );
    }
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
    <div className={cn("flex items-start gap-3 rounded-etiqueta border p-4", c.box)}>
      <Icon size={20} strokeWidth={1.75} className={cn("shrink-0", c.icon)} aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}
