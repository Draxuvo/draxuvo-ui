// src/components/payroll/pay-dialog.tsx
// Registrar un pago, o todos los pendientes, de una corrida (spec 037). Solo deja constancia: no mueve dinero.
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { money, todayIso } from "@/lib/payroll";
import { payrollService } from "@/services/payroll";
import { PAYROLL_METHODS, type PayrollMethod, type PayrollPayment, type PayrollRun } from "@/types";
import { Select } from "@/components/ui/select";

const FIELD =
  "h-10 md:h-9 w-full rounded-etiqueta border border-input bg-card px-2.5 text-sm text-foreground tabular-nums transition-colors duration-[120ms] hover:border-foreground/40 foco-etiqueta";

/** `payment` = una línea; sin ella, todas las pendientes de la corrida. */
export type PayTarget = { run: PayrollRun; payment?: PayrollPayment } | null;

export function PayDialog({ target, onClose }: { target: PayTarget; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      {/* Cada apertura monta el formulario de cero: método, fecha y llave de idempotencia nuevos. */}
      {target && <PayForm key={`${target.run.id}-${target.payment?.id ?? "all"}`} target={target} onClose={onClose} />}
    </Dialog>
  );
}

function PayForm({ target, onClose }: { target: NonNullable<PayTarget>; onClose: () => void }) {
  const t = useTranslations("payroll.pay");
  const tm = useTranslations("payroll.method");
  const locale = useLocale();
  const qc = useQueryClient();
  const today = todayIso();
  const [method, setMethod] = useState<PayrollMethod>("cash");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  // La misma llave en los reintentos de este formulario: repetir el envío no duplica el pago.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const { run, payment } = target;
  const pending = (run.payments ?? []).filter((p) => p.status === "pending");
  const future = paidOn > today;

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { method, paid_on: paidOn, reference: reference.trim() || undefined };
      if (payment) await payrollService.pay(payment.id, body, idempotencyKey);
      else await payrollService.payAll(run.id, body, undefined, idempotencyKey);
    },
    onSuccess: () => {
      toast.success(payment ? t("done") : t("doneAll"));
      qc.invalidateQueries({ queryKey: ["payroll-run", run.id] });
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      onClose();
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{payment ? t("title") : t("titleAll")}</DialogTitle>
        <DialogDescription>
          {payment
            ? `${payment.employee_name} · ${money(payment.net_cents, locale)}`
            : t("descriptionAll", { count: pending.length, total: money(pending.reduce((s, p) => s + p.net_cents, 0), locale) })}
          {" "}
          {t("description")}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pay-method">{t("method")}</Label>
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PayrollMethod)}>
            {PAYROLL_METHODS.map((m) => (
              <option key={m} value={m}>{tm(m)}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-date">{t("date")}</Label>
          <input id="pay-date" type="date" className={FIELD} value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pay-reference">{t("reference")}</Label>
        <input id="pay-reference" className={FIELD} maxLength={80} placeholder={t("referencePlaceholder")} value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      {future && <p role="alert" className="text-sm text-destructive">{t("futureDate")}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>{t("cancel")}</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || future || !paidOn}>{t("confirm")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
