// src/components/system-status/status-card.tsx — tarjeta genérica del estado del sistema (spec 073, FR-015): título,
// estado con color, hora de lectura y aviso de dato viejo cuando un tercero falló.
"use client";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatWhen } from "@/lib/login-attempts";
import type { SystemStatusState } from "@/types";

const TONES: Record<SystemStatusState, string> = {
  ok: "bg-success/10 text-success",
  warn: "bg-warning/15 text-foreground",
  down: "bg-destructive/10 text-destructive",
  unconfigured: "bg-muted text-muted-foreground",
  invalid_token: "bg-destructive/10 text-destructive",
  unreachable: "bg-warning/15 text-foreground",
};

export function StateBadge({ state }: { state: SystemStatusState }) {
  const t = useTranslations("systemStatus.states");
  return (
    <span data-state={state} className={cn("inline-flex h-6 items-center rounded-etiqueta px-2 text-xs font-medium", TONES[state])}>
      {t(state)}
    </span>
  );
}

export function StatusCard({
  title,
  state,
  checkedAt,
  stale,
  lastGoodAt,
  failureState,
  action,
  children,
}: {
  title: string;
  state: SystemStatusState;
  checkedAt?: string | null;
  stale?: boolean;
  lastGoodAt?: string | null;
  failureState?: SystemStatusState;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslations("systemStatus");
  const locale = useLocale();
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-etiqueta border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {checkedAt && <p className="text-xs text-muted-foreground">{t("checkedAt", { when: formatWhen(checkedAt, locale) })}</p>}
        </div>
        <StateBadge state={state} />
      </header>
      {stale && lastGoodAt && (
        <p role="status" className="rounded-etiqueta bg-warning/15 px-2 py-1 text-xs text-foreground">
          {t("stale", { when: formatWhen(lastGoodAt, locale), reason: t(`states.${failureState ?? "unreachable"}`) })}
        </p>
      )}
      {children}
      {action}
    </section>
  );
}
