// src/components/attendance/attendance-button.tsx
// Acceso fijo para marcar entrada o salida y ver el estado de hoy (spec 026).
"use client";
import { useLocale, useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { useMyAttendance } from "@/hooks/use-my-attendance";
import { cn } from "@/lib/utils";
import { shortTime } from "./time";

const BUTTON =
  "foco-etiqueta flex min-h-11 shrink-0 items-center gap-2 rounded-etiqueta px-2 text-sm font-medium text-muted-foreground transition-colors duration-[120ms] hover:bg-card hover:text-foreground disabled:opacity-60 sm:px-3";

export function AttendanceButton() {
  const t = useTranslations("attendance.status");
  const locale = useLocale();
  const { data, state, eligible, checkIn, checkOut } = useMyAttendance();
  if (!eligible || !state || !data) return null;

  const pending = checkIn.isPending || checkOut.isPending;
  const onError = () => toast.error(t("error"));

  if (state === "working" && data.current) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => checkOut.mutate(undefined, { onSuccess: () => toast.success(t("checkedOut")), onError })}
        className={cn(BUTTON, "text-foreground")}
        aria-label={t("markOutLabel", { time: shortTime(data.current.checkin_at, locale) })}
      >
        <Clock size={16} strokeWidth={1.75} aria-hidden />
        <span className="hidden lg:inline">{t("working", { time: shortTime(data.current.checkin_at, locale) })} · </span>
        <span>{t("markOut")}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => checkIn.mutate(undefined, { onSuccess: () => toast.success(t("checkedIn")), onError })}
      className={BUTTON}
    >
      <Clock size={16} strokeWidth={1.75} aria-hidden />
      {state === "done" && data.last?.checkout_at && (
        <span className="hidden lg:inline">{t("done", { time: shortTime(data.last.checkout_at, locale) })} · </span>
      )}
      <span>{t("markIn")}</span>
    </button>
  );
}
