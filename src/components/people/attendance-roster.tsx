// src/components/people/attendance-roster.tsx
// "Hoy por empleado" (spec 036): todos los empleados activos con su estado del día. Administrador y dueño marcan
// entrada y salida desde aquí; el gerente solo lo ve.
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { attendancesService } from "@/services/attendances";
import { MarkDialog, type MarkTarget } from "@/components/attendance/mark-dialog";
import { shortTime } from "@/components/attendance/time";
import type { RosterRow } from "@/types";
import { cn } from "@/lib/utils";

const STATE_BADGE: Record<RosterRow["state"], string> = {
  none: "bg-muted text-muted-foreground",
  working: "bg-ceja text-foreground",
  done: "bg-sello text-etiqueta",
};

export function AttendanceRoster({ canMark, enabled }: { canMark: boolean; enabled: boolean }) {
  const t = useTranslations("attendance.roster");
  const locale = useLocale();
  const [target, setTarget] = useState<MarkTarget | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    enabled,
    queryKey: ["roster"],
    queryFn: () => attendancesService.roster(),
  });
  const rows = data?.results ?? [];

  return (
    <section aria-labelledby="roster-title" className="space-y-3">
      <h2 id="roster-title" className="font-display text-xl font-semibold leading-tight text-foreground">
        {t("title")}
      </h2>
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-etiqueta border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {t("loadError")}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-etiqueta bg-card px-4 py-6 text-center text-sm text-muted-foreground shadow-etiqueta">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-etiqueta bg-card shadow-etiqueta">
          {rows.map((row) => {
            const a = row.attendance;
            return (
              <li key={row.employee.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{row.employee.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.state === "none" && t("noEntry")}
                    {row.state === "working" && a && t("workingSince", { time: shortTime(a.checkin_at, locale) })}
                    {row.state === "done" && a && a.checkout_at && t("doneRange", { from: shortTime(a.checkin_at, locale), to: shortTime(a.checkout_at, locale) })}
                    {a && (a.checkin_captured || a.checkout_captured) && a.checkin_by && ` · ${t("capturedBy", { name: a.checkout_by?.name ?? a.checkin_by.name })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", STATE_BADGE[row.state])}>
                    {t(`state.${row.state}`)}
                  </span>
                  {canMark && row.state !== "working" && (
                    <Button size="sm" variant="outline" onClick={() => setTarget({ employeeId: row.employee.id, name: row.employee.name, kind: "in" })}>
                      {t("markIn")}
                    </Button>
                  )}
                  {canMark && row.state === "working" && (
                    <Button size="sm" onClick={() => setTarget({ employeeId: row.employee.id, name: row.employee.name, kind: "out" })}>
                      {t("markOut")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <MarkDialog target={target} onClose={() => setTarget(null)} />
    </section>
  );
}
