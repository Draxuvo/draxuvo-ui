// src/components/payroll/adjustment-dialog.tsx
// Bonos y deducciones de una línea en borrador, y correcciones de pagos anteriores (spec 037).
"use client";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { money, pesosToCents } from "@/lib/payroll";
import { formatDay } from "@/lib/reports/format";
import { payrollService } from "@/services/payroll";
import type { PayrollPayment, PayrollRun } from "@/types";

const FIELD =
  "h-9 w-full rounded-etiqueta border border-input bg-card px-2.5 text-sm text-foreground transition-colors duration-[120ms] hover:border-foreground/40 foco-etiqueta";

/** Lee la línea de la corrida que se está viendo, así los ajustes nuevos aparecen al refrescar. */
export function AdjustmentDialog({ run, paymentId, onClose }: { run: PayrollRun; paymentId: number | null; onClose: () => void }) {
  const payment = run.payments?.find((p) => p.id === paymentId);
  return (
    <Dialog open={!!payment} onOpenChange={(open) => !open && onClose()}>
      {payment && <AdjustmentForm key={payment.id} run={run} payment={payment} onClose={onClose} />}
    </Dialog>
  );
}

function AdjustmentForm({ run, payment, onClose }: { run: PayrollRun; payment: PayrollPayment; onClose: () => void }) {
  const t = useTranslations("payroll.adjust");
  const locale = useLocale();
  const qc = useQueryClient();
  const editable = run.status === "draft";

  const schema = z.object({
    kind: z.enum(["bonus", "deduction"]),
    amount: z.string().refine((v) => pesosToCents(v) > 0, t("amountInvalid")),
    note: z.string().trim().min(1, t("noteRequired")).max(200),
    corrects: z.boolean(),
    corrects_payment_id: z.string(),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { kind: "bonus", amount: "", note: "", corrects: false, corrects_payment_id: "" },
  });
  const corrects = useWatch({ control, name: "corrects" });

  // Pagos hechos del mismo empleado, para registrar una corrección.
  const { data: history } = useQuery({
    queryKey: ["payroll-history", payment.employee_id],
    queryFn: () => payrollService.employeeHistory(payment.employee_id!),
    enabled: editable && corrects && !!payment.employee_id,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["payroll-run", run.id] });
    qc.invalidateQueries({ queryKey: ["payroll-runs"] });
  };

  const add = useMutation({
    mutationFn: (v: Values) =>
      payrollService.addAdjustment(payment.id, {
        kind: v.kind,
        amount_cents: pesosToCents(v.amount),
        note: v.note.trim(),
        corrects_payment_id: v.corrects && v.corrects_payment_id ? Number(v.corrects_payment_id) : undefined,
      }),
    onSuccess: () => {
      toast.success(t("added"));
      reset();
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => payrollService.removeAdjustment(id),
    onSuccess: () => {
      toast.success(t("removed"));
      refresh();
    },
  });

  const adjustments = payment.adjustments ?? [];

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("title", { name: payment.employee_name })}</DialogTitle>
        <DialogDescription>{editable ? t("description") : t("readOnly")}</DialogDescription>
      </DialogHeader>

      {adjustments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-etiqueta border border-border">
          {adjustments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {a.kind === "bonus" ? t("bonus") : t("deduction")} · <span className="tabular-nums">{money(a.amount_cents, locale)}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{a.note}</p>
              </div>
              {editable && (
                <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => remove.mutate(a.id)} disabled={remove.isPending}>
                  <Trash2 size={15} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form onSubmit={handleSubmit((v) => add.mutate(v))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adj-kind">{t("kind")}</Label>
              <select id="adj-kind" className={FIELD} {...register("kind")}>
                <option value="bonus">{t("bonus")}</option>
                <option value="deduction">{t("deduction")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-amount">{t("amount")}</Label>
              <input id="adj-amount" inputMode="decimal" className={`${FIELD} tabular-nums`} {...register("amount")} />
              {errors.amount && <p role="alert" className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-note">{t("note")}</Label>
            <input id="adj-note" className={FIELD} maxLength={200} placeholder={t("notePlaceholder")} {...register("note")} />
            {errors.note && <p role="alert" className="text-xs text-destructive">{errors.note.message}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("corrects")} />
            {t("corrects")}
          </label>
          {corrects && (
            <div className="space-y-1.5">
              <Label htmlFor="adj-corrects">{t("correctsPick")}</Label>
              <select id="adj-corrects" className={FIELD} {...register("corrects_payment_id")}>
                <option value="">—</option>
                {(history?.results ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.run ? `${formatDay(p.run.starts_on, locale)} – ${formatDay(p.run.ends_on, locale)}` : p.id} · {money(p.net_cents, locale)}
                  </option>
                ))}
              </select>
              {history && history.results.length === 0 && <p className="text-xs text-muted-foreground">{t("noPaid")}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("close")}</Button>
            <Button type="submit" disabled={add.isPending}>{t("add")}</Button>
          </DialogFooter>
        </form>
      )}
      {!editable && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("close")}</Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
}
