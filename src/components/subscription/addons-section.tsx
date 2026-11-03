"use client";
// Módulos adicionales de la suscripción (spec 053): los enciende y apaga solo el super admin, así que el cliente los ve
// en solo lectura (con «Activo hasta» si tienen la baja programada) y en el desglose del cobro. Sin ninguno no se pinta nada.
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Puzzle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/components/subscription/plan-picker";
import type { BillingCycle, Subscription } from "@/types";

const DATE_LOCALES = { es, en: enUS };

interface AddonsSectionProps {
  subscription: Subscription;
  /** Ciclo con el que se muestra el precio (el de la suscripción). */
  cycle: BillingCycle;
}

export function AddonsSection({ subscription, cycle }: AddonsSectionProps) {
  const t = useTranslations("subscription.addons");
  const tm = useTranslations("modules");
  const locale = useLocale() as "es" | "en";
  const addons = subscription.addons ?? [];
  if (addons.length === 0) return null;

  const formatDate = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy", { locale: DATE_LOCALES[locale] }) : "");

  return (
    <section aria-labelledby="addons-heading" className="space-y-4 rounded-etiqueta border border-border bg-card p-4 text-card-foreground shadow-etiqueta sm:p-6">
      <div>
        <h2 id="addons-heading" className="font-display text-2xl font-extrabold uppercase leading-none">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("desc")}</p>
      </div>
      <ul className="space-y-3">
        {addons.map((addon) => (
          <li key={addon.module} className="flex flex-wrap items-center justify-between gap-3 rounded-etiqueta border border-border bg-background p-3">
            <p className="flex items-center gap-2 font-semibold">
              <Puzzle size={16} aria-hidden />
              {tm(addon.module)}
              <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-xs font-semibold">
                {addon.status === "ending" ? t("endsOn", { date: formatDate(addon.ends_at) }) : t("active")}
              </Badge>
            </p>
            <p className="text-sm tabular-nums">
              {t(cycle === "monthly" ? "perMonth" : "perYear", { price: formatCents(addon.amount_cents) })} · {t("beforeTax")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Desglose del cobro recurrente: plan, cada módulo extra, subtotal, IVA y total (spec 050, FR-004). */
export function BillingBreakdown({ subscription, planName }: { subscription: Subscription; planName: string }) {
  const t = useTranslations("subscription.addons");
  const tm = useTranslations("modules");
  const addons = subscription.addons ?? [];
  if (addons.length === 0) return null;
  const subtotal = subscription.amount_cents + (subscription.addons_cents ?? 0);

  return (
    <dl aria-label={t("breakdown.title")} className="space-y-1 rounded-etiqueta border border-border bg-background p-3 text-sm tabular-nums">
      <Row label={t("breakdown.plan", { plan: planName })} value={formatCents(subscription.amount_cents)} />
      {addons.map((addon) => (
        <Row key={addon.module} label={t("breakdown.addon", { name: tm(addon.module) })} value={formatCents(addon.amount_cents)} />
      ))}
      <Row label={t("breakdown.subtotal")} value={formatCents(subtotal)} />
      <Row label={t("breakdown.iva")} value={formatCents(subscription.iva_cents)} />
      <Row label={t("breakdown.total")} value={formatCents(subscription.total_cents)} strong />
    </dl>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-4 border-t border-border pt-1 font-semibold" : "flex justify-between gap-4"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
