// src/components/attendance/logout-dialog.tsx
// Cerrar sesión con un turno abierto ofrece marcar la salida (spec 026).
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyAttendance } from "@/hooks/use-my-attendance";
import { useAuthStore } from "@/store/auth";

/** `requestLogout` pregunta si hay turno abierto; `dialog` se renderiza donde se use. */
export function useLogoutFlow() {
  const t = useTranslations("attendance.logout");
  const logout = useAuthStore((s) => s.logout);
  const { state, checkOut } = useMyAttendance();
  const [open, setOpen] = useState(false);

  const requestLogout = () => (state === "working" ? setOpen(true) : logout());

  const markAndLogout = () =>
    checkOut.mutate(undefined, {
      onSuccess: () => logout(),
      onError: () => toast.error(t("error")),
    });

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-wrap">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={checkOut.isPending}>
            {t("cancel")}
          </Button>
          <Button variant="outline" onClick={logout} disabled={checkOut.isPending}>
            {t("withoutMarking")}
          </Button>
          <Button onClick={markAndLogout} disabled={checkOut.isPending}>
            {t("markAndLogout")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestLogout, dialog };
}
