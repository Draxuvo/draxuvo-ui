"use client";
// src/components/terminal-charge/refund-prompt.tsx — confirmación del reembolso dentro del diálogo de anulación
// (spec 069, FR-031 y FR-033): «Se devolverán $X a la tarjeta cobrada en Caja 1»; si el proveedor no lo acepta, el motivo,
// reintentar o «Anular sin reembolso» con una segunda confirmación.
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/components/pos/lib";
import { REFUND_REASONS, type RefundStep } from "./refund";

interface Props {
  step: RefundStep;
  pending: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onSkipConfirmed: () => void;
  onBack: () => void;
}

export function RefundPrompt({ step, pending, onConfirm, onSkip, onSkipConfirmed, onBack }: Props) {
  const t = useTranslations("terminalCharge.refund");
  const locale = useLocale() as "es" | "en";
  const lines = step.refunds.map((line) => (
    <li key={line.ticket_payment_id}>
      {t("line", { amount: formatMoney(line.amount, locale), terminal: line.terminal?.name ?? t("unknownTerminal") })}
    </li>
  ));

  if (step.kind === "confirm") {
    return (
      <div className="space-y-3">
        <ul className="space-y-1 rounded-etiqueta border border-border bg-muted/40 p-3 text-sm font-medium">{lines}</ul>
        <p className="text-sm text-muted-foreground">{t("confirmHint")}</p>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onBack} disabled={pending}>
            {t("back")}
          </Button>
          <Button variant="destructive" className="h-11" onClick={onConfirm} disabled={pending}>
            {pending ? t("refunding") : t("confirm")}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (step.kind === "failed") {
    const known = (REFUND_REASONS as readonly string[]).includes(step.reason);
    return (
      <div className="space-y-3">
        <div role="alert" className="space-y-1 rounded-etiqueta border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">{t("failedTitle")}</p>
          <p>{known ? t(`reasons.${step.reason}`) : (step.message ?? t("reasons.refund_rejected"))}</p>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" className="h-11" onClick={onSkip} disabled={pending}>
            {t("skip")}
          </Button>
          <Button className="h-11" onClick={onConfirm} disabled={pending}>
            {pending ? t("refunding") : t("retry")}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lines.length > 0 && <ul className="space-y-1 text-sm">{lines}</ul>}
      <p className="text-sm">{t("skipWarning")}</p>
      <DialogFooter>
        <Button variant="outline" className="h-11" onClick={onBack} disabled={pending}>
          {t("back")}
        </Button>
        <Button variant="destructive" className="h-11" onClick={onSkipConfirmed} disabled={pending}>
          {t("skipConfirm")}
        </Button>
      </DialogFooter>
    </div>
  );
}
