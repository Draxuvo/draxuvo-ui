// src/components/alerts/alert-list.tsx — alertas activas y pospuestas de la empresa (spec 045, FR-004 a FR-008).
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts, useSnoozeAlert, useUnsnoozeAlert } from "@/hooks/use-alerts";
import { alertSubjectKey } from "@/services/alerts";
import type { OperationalAlert, SnoozeMinutes, SnoozableAlertKind } from "@/types";
import { AlertRow } from "./alert-row";

const FIRST_PAGE = 50;
const MAX_PAGE = 100;

export function AlertList() {
  const t = useTranslations("alerts");
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isError, refetch } = useAlerts({ pageSize: expanded ? MAX_PAGE : FIRST_PAGE });
  const snooze = useSnoozeAlert();
  const unsnooze = useUnsnoozeAlert();
  const busy = snooze.isPending || unsnooze.isPending;

  function postpone(alert: OperationalAlert, minutes: SnoozeMinutes) {
    snooze.mutate(
      { kind: alert.kind as SnoozableAlertKind, subject_key: alertSubjectKey(alert), minutes },
      { onSuccess: () => toast.success(t("snooze.done")) },
    );
  }

  function restore(alert: OperationalAlert) {
    unsnooze.mutate(
      { kind: alert.kind as SnoozableAlertKind, subjectKey: alertSubjectKey(alert) },
      { onSuccess: () => toast.success(t("snooze.undone")) },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="rounded-etiqueta border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-foreground">{t("error.title")}</p>
        <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => refetch()}>
          {t("error.retry")}
        </Button>
      </div>
    );
  }

  const shown = data.results.length;
  const hasMore = data.count > shown;
  const empty = data.count === 0 && data.snoozed.length === 0;

  return (
    <div className="space-y-6">
      {empty && (
        <div className="flex flex-col items-center gap-2 rounded-etiqueta border border-border bg-card p-8 text-center">
          <CircleCheck size={28} strokeWidth={1.5} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
          <p className="text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      )}

      {data.count > 0 && (
        <section aria-label={t("tabs.active")} className="space-y-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("countActive", { count: data.count })}
          </p>
          <ul className="space-y-2">
            {data.results.map((alert) => (
              <AlertRow key={alert.id} alert={alert} busy={busy} onSnooze={(minutes) => postpone(alert, minutes)} />
            ))}
          </ul>
          {hasMore && !expanded && (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setExpanded(true)}>
              {t("more")}
            </Button>
          )}
          {hasMore && expanded && <p className="text-sm text-muted-foreground">{t("capped", { shown, total: data.count })}</p>}
        </section>
      )}

      {data.snoozed.length > 0 && (
        <section aria-label={t("snoozedTitle", { count: data.snoozed.length })} className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">{t("snoozedTitle", { count: data.snoozed.length })}</h2>
          <ul className="space-y-2">
            {data.snoozed.map((alert) => (
              <AlertRow key={alert.id} alert={alert} busy={busy} onUnsnooze={() => restore(alert)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
