"use client";
// Cobro de una venta de mostrador (spec 050): mismos pagos que el cobro de órdenes (efectivo con cambio, tarjeta con
// terminal y transferencia con referencia, solos o mezclados). Al confirmar muestra el folio, el cambio y, si faltaron
// piezas en el inventario, el aviso para quien cobra.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_PAYMENTS, PaymentRow, emptyRow, newKey, num, round, type PaymentRowState } from "@/components/work-orders/charge-dialog";
import { useChargeSale } from "@/hooks/use-sales";
import { usePaymentTerminals } from "@/hooks/use-payment-terminals";
import type { ChargePaymentInput, PaymentMethod, Sale, SaleChargeResult } from "@/types";
import { CHARGE_ERROR_CODES, errorCode, formatMoney } from "./lib";
import { SaleTicket } from "./sale-ticket";

const PAYMENT_ERROR_CODES = [
  "missing", "exceeds_total", "multiple_cash", "reference_required", "invalid_terminal", "invalid_amount", "invalid_card_last4", "too_many_payments",
] as const;

interface PosChargeDialogProps {
  sale: Sale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama al terminar con el resultado del cobro (para pasar a la venta nueva). */
  onDone: (result: SaleChargeResult) => void;
}

export function PosChargeDialog({ sale, open, onOpenChange, onDone }: PosChargeDialogProps) {
  const t = useTranslations("pos");
  const tw = useTranslations("workOrders");
  const locale = useLocale();
  const total = Number(sale.total);
  const { data: terminals = [] } = usePaymentTerminals({ enabled: open });
  const [rows, setRows] = useState<PaymentRowState[]>([emptyRow(0, "cash")]);
  const [idempotencyKey] = useState(newKey);
  const [result, setResult] = useState<SaleChargeResult | null>(null);
  const charge = useChargeSale(sale.id);

  const single = rows.length === 1;
  const amountOf = (row: PaymentRowState) => (single ? total : num(row.amount));
  const nonCash = round(rows.filter((r) => r.method !== "cash").reduce((sum, r) => sum + amountOf(r), 0));
  const cashRow = rows.find((r) => r.method === "cash");
  const cashDue = round(total - nonCash);
  const received = cashRow ? num(cashRow.received) : 0;
  const missing = cashRow ? Math.max(0, round(cashDue - received)) : Math.max(0, cashDue);
  const change = cashRow && received > cashDue ? round(received - cashDue) : 0;
  const exceeds = nonCash > total;
  const defaultTerminal = terminals.length === 1 ? String(terminals[0].id) : "";
  const rowValid = (row: PaymentRowState) =>
    (row.method === "cash" ? row.received !== "" : single || num(row.amount) > 0) &&
    (row.method !== "card" || terminals.length === 0 || (row.terminalId || defaultTerminal) !== "") &&
    (row.method !== "card" || row.last4 === "" || /^\d{4}$/.test(row.last4)) &&
    (row.method !== "transfer" || row.reference.trim() !== "");
  const canConfirm = !exceeds && missing === 0 && (!cashRow || cashDue > 0) && rows.every(rowValid);

  const patch = (key: number, changes: Partial<PaymentRowState>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  function addRow() {
    const method: PaymentMethod = cashRow ? "card" : "cash";
    setRows((prev) => {
      const filled = prev.map((r) => (r.method !== "cash" && r.amount === "" ? { ...r, amount: String(total) } : r));
      const covered = round(filled.filter((r) => r.method !== "cash").reduce((sum, r) => sum + num(r.amount), 0));
      const rest = Math.max(0, round(total - covered));
      return [...filled, { ...emptyRow(Date.now(), method), amount: method === "cash" ? "" : String(rest) }];
    });
  }

  function toPayload(): ChargePaymentInput[] {
    return rows.map((row) => {
      if (row.method === "cash") return { method: "cash", amount_received: num(row.received) };
      const amount = amountOf(row);
      if (row.method === "transfer") return { method: "transfer", amount, reference: row.reference.trim() };
      const terminal = row.terminalId || defaultTerminal;
      return {
        method: "card",
        amount,
        ...(terminal ? { terminal_id: Number(terminal) } : {}),
        ...(row.authorization.trim() ? { authorization_code: row.authorization.trim() } : {}),
        ...(row.last4 ? { card_last4: row.last4 } : {}),
      };
    });
  }

  function confirm() {
    charge.mutate(
      { lockVersion: sale.lock_version, payments: toPayload(), idempotencyKey },
      {
        onSuccess: setResult,
        onError: (err) => {
          const code = errorCode(err);
          if (code && (PAYMENT_ERROR_CODES as readonly string[]).includes(code)) return void toast.error(tw(`charge.errors.${code}`));
          if (code && (CHARGE_ERROR_CODES as readonly string[]).includes(code)) return void toast.error(t(`charge.errors.${code}`));
          toast.error(t("charge.errors.generic"));
        },
      },
    );
  }

  function finish() {
    if (result) onDone(result);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : result ? finish() : onOpenChange(false))}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{result ? t("charge.success") : t("charge.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("charge.title")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Check className="size-6 text-sello" aria-hidden="true" />
              {t("charge.folio", { folio: result.sale.ticket?.folio ?? "" })}
            </p>
            {Number(result.sale.ticket?.change_given ?? 0) > 0 && (
              <p className="text-lg font-semibold tabular-nums">
                {t("charge.change")}: {formatMoney(result.sale.ticket?.change_given, locale)}
              </p>
            )}
            <SaleTicket sale={result.sale} />
            {result.shortages.length > 0 && (
              <div role="alert" className="rounded-etiqueta border border-border bg-muted p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <TriangleAlert size={16} aria-hidden />
                  {t("charge.shortagesTitle")}
                </p>
                <ul className="mt-1 list-disc pl-6">
                  {result.shortages.map((s) => (
                    <li key={s.product_id}>{t("charge.shortageLine", { name: s.name, missing: s.missing })}</li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button className="h-11" onClick={finish}>
                {t("charge.newSale")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-center font-display text-5xl font-extrabold tabular-nums">{formatMoney(total, locale)}</p>

            {rows.map((row, index) => (
              <PaymentRow
                key={row.key}
                row={row}
                index={index}
                single={single}
                cashTaken={!!cashRow && cashRow.key !== row.key}
                terminals={terminals}
                defaultTerminal={defaultTerminal}
                onChange={(changes) => patch(row.key, changes)}
                onRemove={single ? undefined : () => setRows((prev) => prev.filter((r) => r.key !== row.key))}
              />
            ))}

            {rows.length < MAX_PAYMENTS && (
              <Button type="button" variant="outline" className="min-h-11 w-full gap-1.5" onClick={addRow}>
                <Plus size={14} aria-hidden="true" />
                {tw("charge.addPayment")}
              </Button>
            )}

            <p aria-live="polite" className="min-h-6 text-base font-semibold tabular-nums">
              {exceeds
                ? tw("charge.errors.exceeds_total")
                : missing > 0 && (cashRow ? cashRow.received !== "" : !single)
                  ? tw("charge.missing", { amount: formatMoney(missing, locale) })
                  : cashRow && cashRow.received !== ""
                    ? `${tw("charge.change")}: ${formatMoney(change, locale)}`
                    : null}
            </p>

            <DialogFooter>
              <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
                {tw("cancel")}
              </Button>
              <Button className="h-11" disabled={!canConfirm || charge.isPending} onClick={confirm}>
                {charge.isPending ? tw("charge.confirming") : tw("charge.confirm")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
