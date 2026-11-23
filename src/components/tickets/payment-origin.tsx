// src/components/tickets/payment-origin.tsx — origen de un pago con tarjeta (spec 069, US5): «Confirmado por Mercado Pago»
// con la referencia del proveedor, o «Registrado a mano»; y el estado del reembolso si se anuló un cobro integrado.
"use client";
import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck, PenLine } from "lucide-react";
import type { PaymentMethod, PaymentTerminalRef, TerminalRefundInfo } from "@/types";

export interface PaymentOriginInfo {
  method: PaymentMethod | string;
  source?: "manual" | "terminal" | null;
  provider_reference?: string | null;
  terminal?: PaymentTerminalRef | null;
  refund?: TerminalRefundInfo | null;
}

/** Solo los pagos con tarjeta tienen origen; el efectivo y la transferencia siempre se registran a mano. */
export function hasPaymentOrigin(payment: PaymentOriginInfo): boolean {
  return payment.method === "card" && (payment.source === "terminal" || payment.source === "manual" || !!payment.refund);
}

export function PaymentOrigin({ payment, className }: { payment: PaymentOriginInfo; className?: string }) {
  const t = useTranslations("tickets.origin");
  const tp = useTranslations("terminals.providers");
  const tr = useTranslations("terminalCharge.refund");
  const locale = useLocale();
  if (!hasPaymentOrigin(payment)) return null;

  const integrated = payment.source === "terminal";
  const providerKey = payment.terminal?.provider;
  const provider = providerKey && tp.has(providerKey) ? tp(providerKey) : t("provider");
  const money = (value: string) =>
    new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" }).format(Number(value));
  const Icon = integrated ? BadgeCheck : PenLine;

  return (
    <span className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground ${className ?? ""}`}>
      {payment.source && (
        <span className={`inline-flex items-center gap-1 ${integrated ? "font-medium text-foreground" : ""}`}>
          <Icon size={13} aria-hidden="true" />
          {integrated ? t("confirmed", { provider }) : t("manual")}
        </span>
      )}
      {integrated && payment.provider_reference && (
        <span>· {t("reference", { provider, reference: payment.provider_reference })}</span>
      )}
      {payment.refund && <span>· {tr(`status.${payment.refund.status}`, { amount: money(payment.refund.amount) })}</span>}
    </span>
  );
}
