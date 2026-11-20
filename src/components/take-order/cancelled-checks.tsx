"use client";
// Cuentas de mesa canceladas («Liberar mesa») dentro del filtro «Canceladas» de Cuentas y de Mis órdenes (spec 070).
// La API ya recorta lo que ve cada quien; cada una abre su hoja en solo lectura.
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { useCancelledChecks } from "@/hooks/use-restaurant";
import type { CancelledCheckSummary } from "@/types";

type Query = ReturnType<typeof useCancelledChecks>;

export function CancelledChecks({
  query, from, id = "cancelled-checks-title",
}: { query: Query; from: "ordenes" | "mis-ordenes"; id?: string }) {
  const t = useTranslations("takeOrder");
  const locale = useLocale();
  const when = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const checks = query.data?.pages.flatMap((page) => page.results) ?? [];
  const total = query.data?.pages[0]?.info.total ?? 0;

  if (query.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full rounded-etiqueta" />)}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
        {t("cancelledChecksError")}
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void query.refetch()}>
          {t("cancelledChecksRetry")}
        </Button>
      </div>
    );
  }
  if (!checks.length) return null;

  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-display text-xl font-extrabold">
        {t("cancelledChecks")} <span className="text-muted-foreground">({total})</span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {checks.map((check) => {
          const name = checkName(check, t);
          const details = [
            check.cancel_reason || t("cancelledChecksNoReason"),
            t("cancelledChecksItems", { count: check.cancelled_items }),
            check.cancelled_by ? t("cancelledChecksBy", { name: check.cancelled_by.name }) : null,
          ].filter(Boolean);
          return (
            <li key={check.id}>
              <Link
                href={`/${locale}/pedido?cuenta=${check.id}&hoja=1&from=${from}`}
                aria-label={t("cancelledChecksOpen", { name })}
                className="foco-etiqueta flex min-h-16 items-center justify-between gap-3 rounded-etiqueta border border-border bg-card p-4 shadow-etiqueta"
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate font-semibold text-foreground">{name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {check.waiter ? `${t("openChecksWaiter", { name: check.waiter.name })} · ` : ""}
                    {t("cancelledChecksAt", { time: when.format(new Date(check.cancelled_at)) })}
                  </span>
                  <span className="block text-sm text-muted-foreground">{details.join(" · ")}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {query.hasNextPage && (
        <Button type="button" variant="outline" className="min-h-11" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {t("cancelledChecksMore")}
        </Button>
      )}
    </section>
  );
}

/** «Mesa 4», «Para llevar: Rosa» o «Mesa eliminada»; una mesa que ya se llama «Mesa 1» no se repite. */
function checkName(check: CancelledCheckSummary, t: ReturnType<typeof useTranslations<"takeOrder">>): string {
  if (check.table) {
    const table = check.table.name;
    return /^(mesa|table)\b/i.test(table.trim()) ? table : t("openChecksTable", { name: table });
  }
  if (check.takeout_name) return t("openChecksTakeout", { name: check.takeout_name });
  return t("cancelledChecksNoTable");
}
