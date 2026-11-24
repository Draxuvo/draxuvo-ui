// src/components/system-status/system-status.tsx — pantalla «Estado del sistema» (spec 073, US3): API, base de datos,
// trabajos en segundo plano, disponibilidad (Better Stack) y errores (Sentry). Solo super admin.
"use client";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemStatus } from "@/hooks/use-system-status";
import { formatWhen } from "@/lib/login-attempts";
import type { SystemStatus as Status } from "@/types";
import { StatusCard } from "./status-card";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function OutLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4 foco-etiqueta">
      {children}
      <ExternalLink aria-hidden="true" className="size-3.5" />
    </a>
  );
}

/** Motivo de una tarjeta de tercero sin datos: sin token, token inválido o sin conexión. */
function ExternalProblem({ data, source }: { data: Status["uptime"] | Status["errors"]; source: string }) {
  const t = useTranslations("systemStatus");
  if (!["unconfigured", "invalid_token", "unreachable"].includes(data.state)) return null;
  return <p className="text-sm text-muted-foreground">{t(`problems.${data.state}`, { source })}</p>;
}

export function SystemStatus() {
  const t = useTranslations("systemStatus");
  const locale = useLocale();
  const { data, isLoading, isError, refetch, refresh, refreshing } = useSystemStatus();

  if (isLoading) return <Skeleton className="h-96 w-full" aria-busy="true" />;
  if (isError || !data) {
    return (
      <div role="alert" className="rounded-etiqueta border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-foreground">{t("error")}</p>
        <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const { api, database, jobs, uptime, errors, links } = data;
  const when = (iso: string | null) => (iso ? formatWhen(iso, locale) : t("never"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("checkedAt", { when: formatWhen(data.checked_at, locale) })}</p>
        <div className="flex flex-wrap items-center gap-3">
          <OutLink href={links.render}>Render</OutLink>
          <OutLink href={links.sentry}>Sentry</OutLink>
          <OutLink href={links.betterstack}>Better Stack</OutLink>
          <Button type="button" variant="outline" className="min-h-10" onClick={() => refresh()} disabled={refreshing}>
            <RefreshCw aria-hidden="true" className={refreshing ? "animate-spin" : undefined} />
            {t("refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatusCard title={t("cards.api")} state={api.state}>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label={t("api.version")} value={api.version.slice(0, 7)} />
            <Stat label={t("api.environment")} value={api.environment} />
          </dl>
          <p className="text-xs text-muted-foreground">{t("api.bootedAt", { when: when(api.booted_at) })}</p>
        </StatusCard>

        <StatusCard title={t("cards.database")} state={database.state}>
          <dl>
            <Stat label={t("database.latency")} value={database.latency_ms === null ? "—" : `${database.latency_ms} ms`} />
          </dl>
        </StatusCard>

        <StatusCard title={t("cards.jobs")} state={jobs.state}>
          <p className="text-sm">{t("jobs.heartbeat", { when: when(jobs.last_heartbeat_at) })}</p>
          <dl className="grid grid-cols-3 gap-3">
            <Stat label={t("jobs.pending")} value={jobs.pending} />
            <Stat label={t("jobs.running")} value={jobs.running} />
            <Stat label={t("jobs.failed")} value={jobs.failed_24h} />
          </dl>
        </StatusCard>
      </div>

      {(jobs.failures.length > 0 || jobs.late.length > 0) && (
        <section aria-label={t("jobs.detailTitle")} className="space-y-3 rounded-etiqueta border border-border bg-card p-4">
          {jobs.late.length > 0 && (
            <div>
              <h3 className="font-semibold">{t("jobs.lateTitle")}</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {jobs.late.map((task) => (
                  <li key={task.key}>
                    <span className="font-mono text-xs">{task.key}</span> ·{" "}
                    {t("jobs.lastRun", { when: when(task.last_run_at), minutes: Math.round(task.expected_every_seconds / 60) })}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {jobs.failures.length > 0 && (
            <div>
              <h3 className="font-semibold">{t("jobs.failuresTitle")}</h3>
              <ul className="mt-1 divide-y divide-border text-sm">
                {jobs.failures.map((failure, i) => (
                  <li key={`${failure.at}-${i}`} className="py-2">
                    <p>
                      <span className="font-medium">{failure.job_class}</span>
                      {failure.error_class && <span className="text-muted-foreground"> · {failure.error_class}</span>}
                      <span className="text-xs text-muted-foreground"> · {formatWhen(failure.at, locale)}</span>
                    </p>
                    <p className="break-words text-xs text-muted-foreground">{failure.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <StatusCard
          title={t("cards.uptime")}
          state={uptime.state}
          checkedAt={uptime.checked_at}
          stale={uptime.stale}
          lastGoodAt={uptime.last_good_at}
          failureState={uptime.failure_state}
        >
          <ExternalProblem data={uptime} source="Better Stack" />
          {[...(uptime.monitors ?? []), ...(uptime.heartbeats ?? [])].length > 0 && (
            <ul className="divide-y divide-border">
              {[...(uptime.monitors ?? []), ...(uptime.heartbeats ?? [])].map((item) => (
                <li key={item.link} className="flex items-center justify-between gap-2 py-2">
                  <a href={item.link} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm hover:underline">
                    {item.name}
                  </a>
                  <span className="shrink-0 text-xs text-muted-foreground">{t(`uptimeStatus.${UPTIME_KEYS.has(item.status) ? item.status : "other"}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </StatusCard>

        <StatusCard
          title={t("cards.errors")}
          state={errors.state}
          checkedAt={errors.checked_at}
          stale={errors.stale}
          lastGoodAt={errors.last_good_at}
          failureState={errors.failure_state}
        >
          <ExternalProblem data={errors} source="Sentry" />
          {(errors.projects ?? []).map((project) => (
            <div key={project.slug} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
              <p className="flex items-center justify-between text-sm">
                <span className="font-medium">{t(`projects.${project.slug}`)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {t("errorsCount", { count: project.unresolved, capped: project.capped ? "+" : "" })}
                </span>
              </p>
              {project.issues.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {project.issues.map((issue) => (
                    <li key={issue.link} className="flex items-center justify-between gap-2 text-xs">
                      <a href={issue.link} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">
                        {issue.title}
                      </a>
                      <span className="shrink-0 text-muted-foreground">{t("events", { count: issue.count })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </StatusCard>
      </div>
    </div>
  );
}

const UPTIME_KEYS = new Set(["up", "down", "paused", "pending", "maintenance", "validating"]);

