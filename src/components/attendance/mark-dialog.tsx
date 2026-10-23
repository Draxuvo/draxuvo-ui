// src/components/attendance/mark-dialog.tsx
// Marcar la entrada o la salida de otro empleado, con hora opcional pasada (spec 036). Solo administrador y dueño.
"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { attendancesService } from "@/services/attendances";

const TIME_ZONE = "America/Mexico_City";
const OFFSET = "-06:00";
const ERROR_CODES = [
  "already_open", "no_open_attendance", "future_time", "before_checkin", "overlap", "invalid_time", "employee_inactive",
] as const;

const FIELD =
  "h-9 rounded-etiqueta border border-input bg-card px-2.5 text-sm text-foreground tabular-nums transition-colors duration-[120ms] hover:border-foreground/40 foco-etiqueta";

/** `YYYY-MM-DDTHH:mm` en la zona del servidor, el formato del campo datetime-local. */
export function localInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Código de error de la API que la pantalla sabe explicar. */
function errorCode(error: unknown): (typeof ERROR_CODES)[number] | "generic" {
  if (!isAxiosError(error)) return "generic";
  const code = error.response?.data?.error?.details?.code ?? error.response?.data?.error?.code;
  return (ERROR_CODES as readonly string[]).includes(code) ? code : "generic";
}

export type MarkTarget = { employeeId: number; name: string; kind: "in" | "out" };

export function MarkDialog({ target, onClose }: { target: MarkTarget | null; onClose: () => void }) {
  const t = useTranslations("attendance.mark");
  const qc = useQueryClient();
  // La hora que se ofrece es la actual; solo si el jefe la cambia se manda `at` (y queda como "capturada").
  const initial = useMemo(() => localInput(new Date()), [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = value ?? initial;

  const mutation = useMutation({
    mutationFn: () => {
      const at = value && value !== initial ? `${value}:00${OFFSET}` : undefined;
      return target!.kind === "in"
        ? attendancesService.markCheckIn(target!.employeeId, at)
        : attendancesService.markCheckOut(target!.employeeId, at);
    },
    onSuccess: () => {
      toast.success(target!.kind === "in" ? t("doneIn", { name: target!.name }) : t("doneOut", { name: target!.name }));
      qc.invalidateQueries({ queryKey: ["roster"] });
      qc.invalidateQueries({ queryKey: ["attendances"] });
      close();
    },
    onError: (e) => setError(t(`errors.${errorCode(e)}`)),
  });

  const close = () => {
    setValue(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target?.kind === "in" ? t("titleIn", { name: target.name }) : t("titleOut", { name: target?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("when")}
          <input
            type="datetime-local"
            className={FIELD}
            value={shown}
            max={initial}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        </label>
        {shown !== initial && <p className="text-xs text-muted-foreground">{t("capturedNote")}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={mutation.isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !shown}>
            {target?.kind === "in" ? t("confirmIn") : t("confirmOut")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
