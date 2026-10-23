// src/components/payroll/receipt.tsx
// Recibo imprimible de una línea de nómina pagada (spec 037, FR-017). El navegador lo guarda como PDF.
"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/payroll";
import { formatDay } from "@/lib/reports/format";
import { payrollService } from "@/services/payroll";

export function Receipt({ runId, paymentId }: { runId: number; paymentId: number }) {
  const t = useTranslations("payroll.receipt");
  const tm = useTranslations("payroll.method");
  const locale = useLocale();
  const { data: p, isLoading, isError, refetch } = useQuery({
    queryKey: ["payroll-receipt", paymentId],
    queryFn: () => payrollService.receipt(paymentId),
  });

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5 print:hidden">
      <Link href={`/${locale}/personal?tab=nomina&run=${runId}`}>
        <ArrowLeft size={15} /> {t("back")}
      </Link>
    </Button>
  );

  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">…</p>;
  if (isError || !p || !p.run) {
    return (
      <div className="space-y-4">
        {back}
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" onClick={() => refetch()}>↻</Button>
        </div>
      </div>
    );
  }

  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );

  return (
    <div className="space-y-4">
      {back}
      <article aria-label={t("title")} className="mx-auto max-w-xl rounded-etiqueta border border-border bg-card p-6 print:max-w-none print:border-0 print:p-0">
        <header className="mb-4 flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{p.company?.name}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={() => window.print()}>
            <Printer size={14} /> {t("print")}
          </Button>
        </header>
        <dl className="divide-y divide-border text-sm">
          {row(t("employee"), p.employee_name, true)}
          {row(t("period"), `${formatDay(p.run.starts_on, locale)} – ${formatDay(p.run.ends_on, locale)}`)}
          {row(t("salary"), money(p.salary_cents, locale))}
          {p.days_paid !== p.period_days && row(t("daysPaid", { days: p.days_paid, total: p.period_days }), "")}
          {row(t("bonuses"), money(p.bonus_cents, locale))}
          {row(t("deductions"), money(p.deduction_cents, locale))}
          {row(t("net"), money(p.net_cents, locale), true)}
          {p.method && row(t("method"), tm(p.method))}
          {p.paid_on && row(t("paidOn"), formatDay(p.paid_on, locale))}
          {p.reference && row(t("reference"), p.reference)}
        </dl>
        {(p.adjustments ?? []).length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {p.adjustments!.map((a) => (
              <li key={a.id}>{a.note} · {money(a.amount_cents, locale)}</li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-xs text-muted-foreground">{t("notice")}</p>
      </article>
    </div>
  );
}
