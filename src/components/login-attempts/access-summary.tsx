// src/components/login-attempts/access-summary.tsx — resumen arriba de «Accesos» (spec 073, US2): entradas y fallos de
// hoy, y las IP y correos con más fallos de la última hora. Tocar uno filtra la lista.
"use client";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoginAttemptsSummary } from "@/hooks/use-login-attempts";
import type { FilterChange } from "./access-filters";

export function AccessSummary({ onFilter }: { onFilter: (change: FilterChange) => void }) {
  const t = useTranslations("accessLog.summary");
  const { data, isLoading, isError } = useLoginAttemptsSummary();

  if (isLoading) return <Skeleton className="h-32 w-full" aria-busy="true" />;
  if (isError || !data) return null;

  const lastHour = (change: FilterChange) =>
    onFilter({ result: "failures", since: String(data.window_minutes), from: null, to: null, ...change });
  const nothing = data.top_ips.length === 0 && data.top_emails.length === 0;

  return (
    <section aria-label={t("title")} className="grid gap-3 md:grid-cols-3">
      <div className="rounded-etiqueta border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t("today")}</p>
        <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
          <span className="text-success">{t("success", { count: data.today.success })}</span>
          <span className="mx-2 text-muted-foreground">·</span>
          <span>{t("failures", { count: data.today.failures })}</span>
        </p>
      </div>

      {nothing ? (
        <p className="rounded-etiqueta border border-border bg-card p-4 text-sm text-muted-foreground md:col-span-2">{t("none")}</p>
      ) : (
        <>
          <TopList
            title={t("topIps")}
            rows={data.top_ips.map((row) => ({ key: row.ip, label: row.ip, count: row.failures, mono: true }))}
            onPick={(ip) => lastHour({ ip, q: null })}
            countLabel={(count) => t("failures", { count })}
          />
          <TopList
            title={t("topEmails")}
            rows={data.top_emails.map((row) => ({ key: row.email, label: row.email, count: row.failures }))}
            onPick={(q) => lastHour({ q, ip: null })}
            countLabel={(count) => t("failures", { count })}
          />
        </>
      )}
    </section>
  );
}

function TopList({
  title,
  rows,
  onPick,
  countLabel,
}: {
  title: string;
  rows: { key: string; label: string; count: number; mono?: boolean }[];
  onPick: (value: string) => void;
  countLabel: (count: number) => string;
}) {
  return (
    <div className="rounded-etiqueta border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              onClick={() => onPick(row.key)}
              className="flex min-h-9 w-full items-center justify-between gap-2 rounded-etiqueta px-2 text-left text-sm hover:bg-muted foco-etiqueta"
            >
              <span className={row.mono ? "truncate font-mono text-xs" : "truncate"}>{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{countLabel(row.count)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
