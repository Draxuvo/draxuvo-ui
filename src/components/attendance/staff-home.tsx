// src/components/attendance/staff-home.tsx
// Inicio del personal cuando su empresa no tiene órdenes de trabajo (p. ej. plan Básico): su asistencia de hoy y el
// botón para marcar entrada o salida, sin avisos de "mejora tu plan" (spec 052, H-40).
"use client";
import { useLocale, useTranslations } from "next-intl";
import { Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyAttendance } from "@/hooks/use-my-attendance";
import { shortTime } from "./time";

export function StaffHome() {
  const t = useTranslations("attendance.home");
  const ts = useTranslations("attendance.status");
  const locale = useLocale();
  const { data, state, eligible, checkIn, checkOut, isLoading } = useMyAttendance();
  const pending = checkIn.isPending || checkOut.isPending;
  const onError = () => toast.error(ts("error"));

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-etiqueta" aria-busy="true" />
      ) : !data || !eligible || !state ? (
        <p className="rounded-etiqueta border border-border bg-card p-4 text-sm text-muted-foreground">{t("notEligible")}</p>
      ) : (
        <section aria-label={t("title")} className="space-y-4 rounded-etiqueta border border-border bg-card p-5 shadow-etiqueta">
          <p className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Clock size={20} aria-hidden="true" />
            {state === "working" && data.current
              ? ts("working", { time: shortTime(data.current.checkin_at, locale) })
              : state === "done" && data.last?.checkout_at
                ? ts("done", { time: shortTime(data.last.checkout_at, locale) })
                : t("notYet")}
          </p>
          {state === "working" ? (
            <Button
              className="h-12 w-full text-base"
              disabled={pending}
              onClick={() => checkOut.mutate(undefined, { onSuccess: () => toast.success(ts("checkedOut")), onError })}
            >
              <LogOut size={18} aria-hidden="true" />
              {ts("markOut")}
            </Button>
          ) : (
            <Button
              className="h-12 w-full text-base"
              disabled={pending}
              onClick={() => checkIn.mutate(undefined, { onSuccess: () => toast.success(ts("checkedIn")), onError })}
            >
              <LogIn size={18} aria-hidden="true" />
              {ts("markIn")}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
