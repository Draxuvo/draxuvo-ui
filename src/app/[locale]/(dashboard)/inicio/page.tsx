// src/app/[locale]/(dashboard)/inicio/page.tsx
// Inicio (R10, contracts/ui-routes.md "Inicio: tarjeta a destino"): totales de GET /dashboard
// (ya no cuenta la primera página de cada lista) y cada acceso abre su destino.
"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CreditCard, Package, RefreshCw, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getDashboardStats } from "@/services/analytics";
import { getSubscription } from "@/services/subscription";
import { StatLinkCard, StatLinkCardSkeleton, type StatLinkCardProps } from "@/components/dashboard/stat-link-card";
import type { ModuleKey, SubscriptionStatus, User } from "@/types";

type Role = User["role"];
const ANALYTICS_ROLES: Role[] = ["owner", "admin", "manager"];
const BILLING_ROLES: Role[] = ["owner", "admin"];

const STATUS_KEY: Record<SubscriptionStatus, string> = {
  trialing: "trialing",
  active: "active",
  past_due: "pastDue",
  cancelled: "cancelled",
  expired: "expired",
};

export default function InicioPage() {
  const t = useTranslations("home");
  const ta = useTranslations("analyticsBoard");
  const tc = useTranslations("common");
  const tp = useTranslations("plans");
  const ts = useTranslations("subscription");
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const role = user?.role;
  const canSeeSubscription = !!role && BILLING_ROLES.includes(role);

  const stats = useQuery({
    queryKey: ["dashboard", selectedCompanyId],
    queryFn: getDashboardStats,
    staleTime: 2 * 60 * 1000,
  });

  // Company ya no trae `plan`; la fuente es GET /subscription (solo owner/admin).
  const subscription = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    enabled: canSeeSubscription,
    retry: false,
  });

  const data = stats.data;
  const can = (module: ModuleKey) =>
    !!data && !!role && data.active_modules.includes(module) && ANALYTICS_ROLES.includes(role);
  const href = (path: string) => `/${locale}${path}`;
  const refreshing = stats.isFetching || subscription.isFetching;

  const cards: (StatLinkCardProps & { id: string })[] = [];
  if (data && can("employees")) {
    cards.push({
      id: "active_employees",
      label: t("activeEmployees"),
      value: data.employees.active,
      href: href("/empleados?status=active"),
      ariaLabel: t("aria.activeEmployees", { count: data.employees.active }),
      icon: Users,
    });
  }
  if (data && can("inventory")) {
    cards.push({
      id: "products",
      label: t("totalProducts"),
      value: data.inventory.total,
      href: href("/inventario"),
      ariaLabel: t("aria.products", { count: data.inventory.total }),
      icon: Package,
      subsets: [{ label: ta("subset.available", { count: data.inventory.available }) }],
    });
    cards.push({
      id: "low_stock",
      label: t("lowStock"),
      value: data.inventory.low_stock,
      href: href("/inventario?low_stock=true"),
      ariaLabel: t("aria.lowStock", { count: data.inventory.low_stock }),
      icon: AlertTriangle,
      subsets:
        data.inventory.out_of_stock > 0
          ? [
              {
                label: ta("subset.outOfStock", { count: data.inventory.out_of_stock }),
                href: href("/inventario?out_of_stock=true"),
                ariaLabel: ta("aria.outOfStock", { count: data.inventory.out_of_stock }),
                highlight: true,
              },
            ]
          : [],
    });
  }
  const sub = subscription.data;
  if (canSeeSubscription && sub) {
    const plan = tp(sub.plan);
    const status = ts(STATUS_KEY[sub.status] ?? "active");
    cards.push({
      id: "plan",
      label: t("activePlan"),
      value: plan,
      href: href("/suscripcion"),
      ariaLabel: t("aria.plan", { plan, status }),
      icon: CreditCard,
      subsets: [{ label: t("planStatus", { status }) }],
    });
  }

  const loading = stats.isLoading || (canSeeSubscription && subscription.isLoading);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">
            {t("welcome", { name: user?.first_name ?? "" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("todaySummary")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            stats.refetch();
            if (canSeeSubscription) subscription.refetch();
          }}
          disabled={refreshing}
          aria-label={tc("refresh")}
          className="rounded-[6px] p-2 text-muted-foreground outline-none transition-colors duration-[120ms] hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground disabled:pointer-events-none"
        >
          <RefreshCw size={18} strokeWidth={1.75} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <section aria-labelledby="inicio-shortcuts">
        <h2 id="inicio-shortcuts" className="mb-3 font-display text-xl font-semibold leading-tight text-foreground">
          {t("shortcuts")}
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatLinkCardSkeleton key={i} />
            ))}
          </div>
        ) : stats.isError ? (
          <div role="alert" className="rounded-[6px] bg-card p-6 text-sm shadow-etiqueta">
            <p className="font-medium text-foreground">{tc("loadError")}</p>
            <button
              type="button"
              onClick={() => stats.refetch()}
              className="mt-3 rounded-[6px] px-1 font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-foreground"
            >
              {tc("retry")}
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ id, ...card }) => (
              <li key={id} className="flex">
                <StatLinkCard {...card} className="w-full" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {role && ANALYTICS_ROLES.includes(role) && (
        <Link
          href={href("/dashboard")}
          className="group inline-flex items-center gap-2 rounded-[6px] px-1 text-sm font-medium text-foreground underline decoration-border underline-offset-4 outline-none transition-colors duration-[120ms] hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-foreground"
        >
          {t("viewDashboard")}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
        </Link>
      )}
    </div>
  );
}
