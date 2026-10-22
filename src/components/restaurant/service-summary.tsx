// src/components/restaurant/service-summary.tsx
"use client";
import { useLocale, useTranslations } from "next-intl";
import type { ServiceOverview } from "@/types";
import { formatMinutes } from "./table-tile";

/** Cuatro cifras vivas del servicio para quien administra (spec 032). */
export function ServiceSummary({ overview }: { overview: ServiceOverview }) {
  const t = useTranslations("restaurant.summary");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const items: { key: string; label: string; value: string; hint?: string }[] = [
    { key: "open", label: t("openChecks"), value: String(overview.open_checks) },
    { key: "pay", label: t("toPay"), value: money.format(Number(overview.to_pay_total)) },
    { key: "pending", label: t("pending"), value: String(overview.pending_comandas) },
    {
      key: "oldest",
      label: t("oldest"),
      value: overview.oldest_open_minutes == null ? "—" : formatMinutes(overview.oldest_open_minutes),
    },
  ];
  return (
    <dl aria-label={t("title")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="rounded-etiqueta border border-border bg-card p-4 shadow-etiqueta">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-display text-3xl font-extrabold leading-none text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
