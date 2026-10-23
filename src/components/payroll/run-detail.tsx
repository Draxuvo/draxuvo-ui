// src/components/payroll/run-detail.tsx
// Una corrida de nómina (spec 037): líneas, ajustes, aprobación, pagos, cancelación, CSV y bitácora.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, History, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { money, STATUS_TONE } from "@/lib/payroll";
import { formatDay } from "@/lib/reports/format";
import { payrollService } from "@/services/payroll";
import type { PayrollEvent, PayrollPayment } from "@/types";
import { AdjustmentDialog } from "./adjustment-dialog";
import { EmployeeHistoryDialog, type HistoryTarget } from "./employee-history-dialog";
import { PayDialog, type PayTarget } from "./pay-dialog";

const NUMBER_FIELD =
  "h-8 w-16 rounded-etiqueta border border-input bg-card px-2 text-right text-sm tabular-nums transition-colors duration-[120ms] hover:border-foreground/40 foco-etiqueta";

type Confirm = "approve" | "discard" | "cancel" | null;

export function RunDetail({ runId, onBack }: { runId: number; onBack: () => void }) {
  const t = useTranslations("payroll");
  const locale = useLocale();
  const qc = useQueryClient();
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget>(null);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");
  const [approveKey, setApproveKey] = useState(() => crypto.randomUUID());

  const { data: run, isLoading, isError, refetch } = useQuery({
    queryKey: ["payroll-run", runId],
    queryFn: () => payrollService.get(runId),
  });

  const reload = () => {
    qc.invalidateQueries({ queryKey: ["payroll-run", runId] });
    qc.invalidateQueries({ queryKey: ["payroll-runs"] });
  };
  // Un 409 (la corrida cambió) recarga lo más reciente y lo avisa; los demás errores salen en el toast global.
  const onError = (error: unknown) => {
    if ((error as { response?: { status?: number } })?.response?.status === 409) {
      toast.info(t("detail.unchanged"));
      reload();
    }
  };

  const refresh = useMutation({
    mutationFn: () => payrollService.refreshEmployees(runId),
    onSuccess: () => { toast.success(t("detail.refreshed")); reload(); },
    onError,
  });
  const discard = useMutation({
    mutationFn: () => payrollService.discard(runId),
    onSuccess: () => { toast.success(t("detail.discarded")); qc.invalidateQueries({ queryKey: ["payroll-runs"] }); onBack(); },
    onError,
  });
  const approve = useMutation({
    mutationFn: () => payrollService.approve(runId, run!.lock_version, approveKey),
    onSuccess: () => { toast.success(t("detail.approved")); setConfirm(null); setApproveKey(crypto.randomUUID()); reload(); },
    onError: (e) => { setConfirm(null); onError(e); },
  });
  const cancel = useMutation({
    mutationFn: () => payrollService.cancel(runId, reason.trim()),
    onSuccess: () => { toast.success(t("detail.cancelled")); setConfirm(null); setReason(""); reload(); },
    onError,
  });
  const setDays = useMutation({
    mutationFn: ({ payment, days }: { payment: PayrollPayment; days: number }) => payrollService.setDaysPaid(payment.id, days, run!.lock_version),
    onSuccess: () => { toast.success(t("detail.daysSaved")); reload(); },
    onError: (e) => { onError(e); reload(); },
  });
  const removeLine = useMutation({
    mutationFn: (payment: PayrollPayment) => payrollService.removeLine(payment.id),
    onSuccess: () => { toast.success(t("detail.lineRemoved")); reload(); },
    onError,
  });

  const downloadCsv = async () => {
    const blob = await payrollService.exportCsv(runId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nomina-${run!.starts_on}-${run!.ends_on}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">…</p>;
  if (isError || !run) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        <Button variant="outline" onClick={() => refetch()}>{t("retry")}</Button>
      </div>
    );
  }

  const payments = run.payments ?? [];
  const isDraft = run.status === "draft";
  const frozen = run.status === "approved" || run.status === "partial" || run.status === "paid";
  const pending = payments.filter((p) => p.status === "pending");
  const anyPaid = payments.some((p) => p.status === "paid");

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={onBack}>
          <ArrowLeft size={15} /> {t("back")}
        </Button>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-semibold leading-tight">
              {formatDay(run.starts_on, locale)} – {formatDay(run.ends_on, locale)}
            </h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={STATUS_TONE[run.status]}>{t(`status.${run.status}`)}</Badge>
              <span>{t(`periodType.${run.period_type}`)}</span>
              {run.created_by && <span>· {t("detail.createdBy", { name: run.created_by.name })}</span>}
              {run.approved_by && <span>· {t("detail.approvedBy", { name: run.approved_by.name })}</span>}
            </p>
            {run.status === "cancelled" && run.cancel_reason && (
              <p className="text-sm text-destructive">{t("detail.cancelledNote", { reason: run.cancel_reason })}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("detail.total")}</p>
            <p className="font-display text-3xl font-semibold tabular-nums">{money(run.total_cents, locale)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <>
            <Button onClick={() => setConfirm("approve")} disabled={approve.isPending || payments.length === 0}>{t("detail.approve")}</Button>
            <Button variant="outline" className="gap-2" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw size={15} /> {t("detail.refresh")}
            </Button>
            <Button variant="outline" onClick={() => setConfirm("discard")}>{t("detail.discard")}</Button>
          </>
        )}
        {frozen && pending.length > 0 && (
          <Button onClick={() => setPayTarget({ run })}>{t("detail.payAll")}</Button>
        )}
        {run.status === "approved" && !anyPaid && (
          <Button variant="outline" onClick={() => setConfirm("cancel")}>{t("detail.cancelRun")}</Button>
        )}
        <Button variant="outline" className="gap-2" onClick={downloadCsv}>
          <Download size={15} /> {t("detail.exportCsv")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-etiqueta border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("detail.employee")}</TableHead>
              <TableHead>{t("detail.attendance")}</TableHead>
              <TableHead className="text-right">{t("detail.daysPaid")}</TableHead>
              <TableHead className="text-right">{t("detail.salary")}</TableHead>
              <TableHead className="text-right">{t("detail.bonuses")}</TableHead>
              <TableHead className="text-right">{t("detail.deductions")}</TableHead>
              <TableHead className="text-right">{t("detail.net")}</TableHead>
              {frozen && <TableHead>{t("detail.state")}</TableHead>}
              <TableHead className="text-right">{t("detail.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.employee_name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t("detail.attendanceValue", { days: p.days_attended, hours: p.hours_worked })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isDraft ? (
                    <DaysInput payment={p} onCommit={(days) => setDays.mutate({ payment: p, days })} invalid={t("detail.daysInvalid", { max: p.period_days })} />
                  ) : (
                    `${p.days_paid}/${p.period_days}`
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{money(p.salary_cents, locale)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(p.bonus_cents, locale)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(p.deduction_cents, locale)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{money(p.net_cents, locale)}</TableCell>
                {frozen && (
                  <TableCell className="text-sm">
                    {p.status === "paid" ? `${t("lineStatus.paid")} · ${p.method ? t(`method.${p.method}`) : ""}` : t("lineStatus.pending")}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label={`${t("detail.adjust")}: ${p.employee_name}`} onClick={() => setAdjustId(p.id)}>
                      <SlidersHorizontal size={15} />
                    </Button>
                    {p.employee_id && (
                      <Button variant="ghost" size="icon" aria-label={`${t("detail.history")}: ${p.employee_name}`} onClick={() => setHistoryTarget({ employeeId: p.employee_id!, name: p.employee_name })}>
                        <History size={15} />
                      </Button>
                    )}
                    {isDraft && (
                      <Button variant="ghost" size="icon" aria-label={`${t("detail.removeLine")}: ${p.employee_name}`} onClick={() => removeLine.mutate(p)} disabled={removeLine.isPending}>
                        <Trash2 size={15} />
                      </Button>
                    )}
                    {frozen && p.status === "pending" && (
                      <Button size="sm" onClick={() => setPayTarget({ run, payment: p })}>{t("detail.pay")}</Button>
                    )}
                    {p.status === "paid" && (
                      <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={`/${locale}/personal/nomina/${run.id}/recibo/${p.id}`}>
                          <FileText size={14} /> {t("detail.receipt")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EventLog events={run.events ?? []} />

      <AdjustmentDialog run={run} paymentId={adjustId} onClose={() => setAdjustId(null)} />
      <PayDialog target={payTarget} onClose={() => setPayTarget(null)} />
      <EmployeeHistoryDialog target={historyTarget} onClose={() => setHistoryTarget(null)} />

      <Dialog open={confirm === "approve" || confirm === "discard"} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "discard" ? t("detail.discardConfirmTitle") : t("detail.approveConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {confirm === "discard" ? t("detail.discardConfirmBody") : t("detail.approveConfirmBody", { total: money(run.total_cents, locale) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>{t("detail.keep")}</Button>
            <Button
              variant={confirm === "discard" ? "destructive" : "default"}
              disabled={approve.isPending || discard.isPending}
              onClick={() => (confirm === "discard" ? discard.mutate() : approve.mutate())}
            >
              {t("detail.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "cancel"} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancel.title")}</DialogTitle>
            <DialogDescription>{t("cancel.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">{t("cancel.reason")}</Label>
            <input
              id="cancel-reason"
              className="h-9 w-full rounded-etiqueta border border-input bg-card px-2.5 text-sm foco-etiqueta"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>{t("cancel.keep")}</Button>
            <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending || !reason.trim()}>
              {t("cancel.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Días a pagar: se confirma al salir del campo (o con Enter) y solo si cambió y es válido. */
function DaysInput({ payment, onCommit, invalid }: { payment: PayrollPayment; onCommit: (days: number) => void; invalid: string }) {
  const [text, setText] = useState(String(payment.days_paid));
  const [prev, setPrev] = useState(payment.days_paid);
  // Si la línea se recarga con otro valor (p. ej. tras un conflicto), el campo lo sigue.
  if (prev !== payment.days_paid) {
    setPrev(payment.days_paid);
    setText(String(payment.days_paid));
  }
  const value = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(value) && value >= 0 && value <= payment.period_days;

  const commit = () => {
    if (!valid) {
      setText(String(payment.days_paid));
      return;
    }
    if (value !== payment.days_paid) onCommit(value);
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        inputMode="numeric"
        aria-label={payment.employee_name}
        aria-invalid={!valid}
        title={valid ? undefined : invalid}
        className={NUMBER_FIELD}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className="text-xs text-muted-foreground">/{payment.period_days}</span>
    </div>
  );
}

function EventLog({ events }: { events: PayrollEvent[] }) {
  const t = useTranslations("payroll");
  const locale = useLocale();
  const label = (e: PayrollEvent) => {
    const d = e.details as { employee?: string; days_paid?: number };
    const key = `events.${e.action}`;
    return t.has(key) ? t(key, { employee: d.employee ?? "", days: d.days_paid ?? 0 }) : e.action;
  };
  return (
    <section aria-labelledby="payroll-events" className="space-y-2">
      <h3 id="payroll-events" className="text-sm font-semibold">{t("detail.events")}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("detail.noEvents")}</p>
      ) : (
        <ol className="divide-y divide-border rounded-etiqueta border border-border text-sm">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span>{label(e)}</span>
              <span className="text-xs text-muted-foreground">
                {e.user?.name} · {new Date(e.created_at).toLocaleString(locale === "en" ? "en-US" : "es-MX", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
