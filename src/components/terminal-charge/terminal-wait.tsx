// src/components/terminal-charge/terminal-wait.tsx — «Esperando terminal…» (spec 069, US1 y US3). Se muestra dentro del
// diálogo de cobro mientras la solicitud espera; al fallar, vencer o no responder ofrece reintentar, elegir otra
// terminal o registrar el pago a mano. Al aplicarse, el diálogo pasa a su pantalla de cobro hecho.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TerminalCharge } from "@/types";
import type { TerminalChargeError } from "./use-terminal-charge";

const WAITING = new Set(["pending", "canceling", "approved", "applied"]);
const DETAILS = new Set([
  "created", "at_terminal", "cancellation_requested", "rejected_by_issuer", "insufficient_amount", "high_risk", "bad_filled_card_data",
  "card_disabled", "amount_limit_exceeded", "max_attempts_exceeded", "required_call_for_authorize", "processing_error",
  "invalid_installments", "in_review", "canceled_on_terminal", "canceled_by_api", "expired", "check_on_terminal", "waiting_payment",
  "provider_unavailable", "amount_out_of_range", "device_offline",
]);
const ERRORS = new Set([
  "terminal_busy", "terminal_charge_pending", "terminal_not_chargeable", "amount_out_of_range", "one_integrated_payment",
  "provider_unavailable", "device_offline", "declined", "not_cancelable", "charge_boss_only",
]);

interface TerminalWaitProps {
  amount: string;
  terminalName: string;
  charge: TerminalCharge | null;
  starting: boolean;
  error: TerminalChargeError | null;
  canceling: boolean;
  /** Traduce los errores propios del cobro (reparto, permisos…); null si no lo conoce. */
  describeError?: (code: string) => string | null;
  onCancel: () => void;
  onRetry: () => void;
  onChooseOther: () => void;
  onManual: () => void;
}

export function TerminalWait({
  amount, terminalName, charge, starting, error, canceling, describeError, onCancel, onRetry, onChooseOther, onManual,
}: TerminalWaitProps) {
  const t = useTranslations("terminalCharge");
  const [confirmManual, setConfirmManual] = useState(false);
  const status = charge?.status;
  const waiting = !error && (starting || !status || WAITING.has(status));
  const detail = charge?.status_detail && DETAILS.has(charge.status_detail) ? t(`details.${charge.status_detail}`) : null;

  let failure: string | null = null;
  if (error) {
    failure = describeError?.(error.code) ?? (ERRORS.has(error.code) ? t(`errors.${error.code}`) : t("errors.generic"));
  } else if (status === "unapplied") {
    failure = t("unapplied");
  } else if (status && !WAITING.has(status)) {
    failure = detail ?? t(`statuses.${status === "abandoned" ? "canceled" : status}`);
  }

  return (
    <div className="space-y-5 text-center">
      <p className="font-display text-4xl font-extrabold tabular-nums">{amount}</p>
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <CreditCard size={16} aria-hidden="true" />
        {terminalName}
      </p>

      {waiting ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="text-lg font-semibold">{status === "canceling" ? t("canceling") : t("waiting")}</p>
          <p className="text-sm text-muted-foreground">{detail ?? t("waitingHint")}</p>
        </div>
      ) : (
        <div role="alert" className="space-y-2">
          <TriangleAlert className="mx-auto size-8 text-destructive" aria-hidden="true" />
          <p className="text-lg font-semibold">{failure}</p>
        </div>
      )}

      {confirmManual && (
        <p role="alert" className="rounded-etiqueta border border-border bg-muted p-3 text-sm">
          {t("manualWarning")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {waiting ? (
          <>
            {status === "pending" && (
              <Button variant="outline" className="min-h-11" disabled={canceling} onClick={onCancel}>
                {t("cancel")}
              </Button>
            )}
            {(status === "pending" || status === "canceling") &&
              (confirmManual ? (
                <Button variant="secondary" className="min-h-11" onClick={onManual}>
                  {t("manualConfirm")}
                </Button>
              ) : (
                <Button variant="ghost" className="min-h-11" onClick={() => setConfirmManual(true)}>
                  {t("manual")}
                </Button>
              ))}
          </>
        ) : (
          <>
            {status !== "unapplied" && (
              <Button className="min-h-11" onClick={onRetry}>
                {t("retry")}
              </Button>
            )}
            <Button variant="outline" className="min-h-11" onClick={onChooseOther}>
              {t("chooseOther")}
            </Button>
            {status !== "unapplied" && (
              <Button variant="ghost" className="min-h-11" onClick={onManual}>
                {t("manual")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
