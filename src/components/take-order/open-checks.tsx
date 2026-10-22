"use client";
// Cuentas de mesa abiertas dentro de Órdenes y Mis órdenes (spec 020): con mesas dadas de alta, la orden se toma como
// una cuenta (spec 018) y vive aparte de las órdenes de trabajo; aquí se listan y cada una abre Tomar pedido.
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNowStrict } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { useTablesOverview } from "@/hooks/use-restaurant";
import { openChecksOf, type OpenCheck } from "./lib";
import { useScreenMode } from "./use-screen-mode";

/** Cuentas abiertas a mostrar; vacío cuando la empresa no trabaja con mesas. Se actualiza con el sondeo del plano. */
export function useOpenChecks(scope: "all" | "mine"): OpenCheck[] {
  const { mode, ready } = useScreenMode();
  const overview = useTablesOverview({ enabled: ready && mode === "restaurant" });
  return mode === "restaurant" ? openChecksOf(overview.data, scope) : [];
}

export function OpenChecks({
  checks, from, title, id = "open-checks-title",
}: { checks: OpenCheck[]; from: "ordenes" | "mis-ordenes"; title?: string; id?: string }) {
  const t = useTranslations("takeOrder");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  if (!checks.length) return null;

  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-display text-xl font-extrabold">
        {title ?? t("openChecks")} <span className="text-muted-foreground">({checks.length})</span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {checks.map((check) => {
          // Si la mesa ya se llama "Mesa 1", no se le antepone otra vez "Mesa".
          const name = check.takeout ? t("openChecksTakeout", { name: check.name }) : /^(mesa|table)\b/i.test(check.name.trim()) ? check.name : t("openChecksTable", { name: check.name });
          const elapsed = formatDistanceToNowStrict(new Date(check.openedAt), { locale: locale === "en" ? enUS : es });
          return (
            <li key={check.id}>
              <Link
                href={`/${locale}/pedido?cuenta=${check.id}&from=${from}`}
                aria-label={t("openChecksOpen", { name: check.name })}
                className="foco-etiqueta flex min-h-16 items-center justify-between gap-3 rounded-etiqueta border border-border bg-card p-4 shadow-etiqueta"
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate font-semibold text-foreground">{name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {check.waiter ? `${t("openChecksWaiter", { name: check.waiter })} · ` : ""}
                    {t("openChecksElapsed", { time: elapsed })}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {check.total != null && (
                    <span className="font-display text-xl font-extrabold tabular-nums">{money.format(check.total)}</span>
                  )}
                  <ChevronRight size={18} className="text-muted-foreground" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
