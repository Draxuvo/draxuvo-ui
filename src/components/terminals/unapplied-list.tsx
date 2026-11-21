"use client";
// src/components/terminals/unapplied-list.tsx — «Pagos sin aplicar» en Terminales (spec 069, FR-020 y FR-035): pagos que
// el proveedor aprobó pero Draxuvo no pudo registrar (por ejemplo, se aprobaron tarde y el cobro ya se había hecho a mano).
// El dueño o el administrador los reembolsa con confirmación o los marca atendidos. Sin pendientes no se muestra.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/components/pos/lib";
import { REFUND_REASONS, refundStepFrom } from "@/components/terminal-charge/refund";
import { useDismissUnapplied, useRefundUnapplied, useUnappliedCharges } from "@/hooks/use-terminal-connections";
import type { TerminalCharge } from "@/types";

type Pending = { charge: TerminalCharge; action: "refund" | "dismiss" };

export function UnappliedList({ enabled = true }: { enabled?: boolean }) {
  const t = useTranslations("terminals.unapplied");
  const tr = useTranslations("terminalCharge.refund");
  const locale = useLocale() as "es" | "en";
  const { data } = useUnappliedCharges({ enabled });
  const refund = useRefundUnapplied();
  const dismiss = useDismissUnapplied();
  const [pending, setPending] = useState<Pending | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const charges = data?.results ?? [];
  if (charges.length === 0) return null;

  const money = (value: string) => formatMoney(value, locale);
  const busy = refund.isPending || dismiss.isPending;

  function close() {
    setPending(null);
    setFailure(null);
  }

  function run() {
    if (!pending) return;
    if (pending.action === "dismiss") {
      dismiss.mutate(pending.charge.id, { onSuccess: () => { toast.success(t("dismissed")); close(); } });
      return;
    }
    refund.mutate(pending.charge.id, {
      onSuccess: () => {
        toast.success(t("refunded"));
        close();
      },
      onError: (err) => {
        const step = refundStepFrom(err);
        const reason = step?.kind === "failed" ? step.reason : "refund_rejected";
        setFailure((REFUND_REASONS as readonly string[]).includes(reason) ? tr(`reasons.${reason}`) : tr("reasons.refund_rejected"));
      },
    });
  }

  return (
    <section aria-labelledby="unapplied-title" className="space-y-3 rounded-etiqueta border border-amber-500/40 bg-amber-500/5 p-4">
      <div>
        <h2 id="unapplied-title" className="font-medium text-foreground">
          {t("title", { count: charges.length })}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card">
        {charges.map((charge) => (
          <li key={charge.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium tabular-nums">
                {money(charge.amount)} · {charge.terminal.name}
              </p>
              <p className="text-muted-foreground">
                {format(new Date(charge.resolved_at ?? charge.created_at), "d MMM yyyy HH:mm", { locale: locale === "en" ? enUS : es })}
                {" · "}
                {charge.owner.label}
                {charge.provider_reference && ` · ${t("reference", { reference: charge.provider_reference })}`}
              </p>
              {charge.unapplied_reason && (
                <p className="text-muted-foreground">{t(`reasons.${charge.unapplied_reason === "already_paid" ? "already_paid" : "other"}`)}</p>
              )}
              {charge.refund?.status === "requested" && <p className="text-muted-foreground">{tr("status.requested", { amount: money(charge.refund.amount) })}</p>}
            </div>
            <div className="flex gap-2">
              {charge.allowed_actions.includes("dismiss") && (
                <Button variant="outline" className="h-11" onClick={() => setPending({ charge, action: "dismiss" })}>
                  {t("dismiss")}
                </Button>
              )}
              {charge.allowed_actions.includes("refund") && (
                <Button className="h-11" onClick={() => setPending({ charge, action: "refund" })}>
                  {t("refund")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pending?.action === "dismiss" ? t("dismissTitle") : t("refundTitle")}</DialogTitle>
            <DialogDescription>
              {pending &&
                (pending.action === "dismiss"
                  ? t("dismissBody")
                  : tr("line", { amount: money(pending.charge.amount), terminal: pending.charge.terminal.name }))}
            </DialogDescription>
          </DialogHeader>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={close} disabled={busy}>
              {tr("back")}
            </Button>
            <Button variant={pending?.action === "refund" ? "destructive" : "default"} className="h-11" onClick={run} disabled={busy}>
              {pending?.action === "dismiss" ? t("dismissConfirm") : busy ? tr("refunding") : failure ? tr("retry") : t("refundConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
