// src/components/attendance/entry-dialog.tsx
// Modal "Marcar entrada" al iniciar sesión (spec 026): una vez por sesión, se puede omitir.
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyAttendance } from "@/hooks/use-my-attendance";
import { useAuthStore } from "@/store/auth";
import { shortTime } from "./time";

export const PROMPTED_PREFIX = "attendance_prompted:";

function wasPrompted(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function EntryDialog() {
  const t = useTranslations("attendance.entry");
  const locale = useLocale();
  const { user, selectedCompanyId } = useAuthStore();
  const { data, state, eligible, checkIn } = useMyAttendance();
  const key = `${PROMPTED_PREFIX}${user?.id}:${selectedCompanyId}`;
  const [closedKey, setClosedKey] = useState<string | null>(null);

  const open = eligible && state !== "working" && closedKey !== key && !wasPrompted(key);

  const close = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // sin sessionStorage el modal solo se omite en esta vista
    }
    setClosedKey(key);
  };

  const mark = () =>
    checkIn.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("done"));
        close();
      },
      onError: () => toast.error(t("error")),
    });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("body", { time: data ? shortTime(data.server_time, locale) : "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={checkIn.isPending}>
            {t("later")}
          </Button>
          <Button onClick={mark} disabled={checkIn.isPending}>
            {t("mark")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
