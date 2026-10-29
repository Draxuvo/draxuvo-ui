"use client";
// Cobrar desde la orden con uno o varios pagos (spec 015): efectivo con lo recibido y el cambio, tarjeta con la
// terminal en que se cobró (y, si se quiere, autorización y últimos 4) y transferencia con su referencia. Con
// un solo pago de tarjeta o transferencia el monto es el total. Al confirmar muestra el folio, el PDF y WhatsApp.
import { useDemoInfo } from "@/hooks/use-demo";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { Banknote, CreditCard, Landmark, Download, MessageCircle, Check, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChargeOrder } from "@/hooks/use-work-orders";
import { usePaymentTerminals } from "@/hooks/use-payment-terminals";
import { useMutation } from "@tanstack/react-query";
import { ticketsService } from "@/services/tickets";
import { downloadTicketPDF } from "@/lib/ticket-pdf";
import type { ChargePaymentInput, PaymentMethod, PaymentTerminal, WorkOrder } from "@/types";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

const METHODS: { key: PaymentMethod; icon: typeof Banknote }[] = [
  { key: "cash", icon: Banknote },
  { key: "card", icon: CreditCard },
  { key: "transfer", icon: Landmark },
];

const MAX_PAYMENTS = 5;
const ERROR_CODES = [
  "missing", "exceeds_total", "multiple_cash", "reference_required", "invalid_terminal", "invalid_amount",
  "invalid_card_last4", "too_many_payments",
] as const;

type Row = {
  key: number;
  method: PaymentMethod;
  amount: string;
  received: string;
  terminalId: string;
  authorization: string;
  last4: string;
  reference: string;
};

const num = (value: string) => {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : 0;
};
const round = (value: number) => Math.round(value * 100) / 100;

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function ChargeDialog({ order, open, onOpenChange }: { order: WorkOrder; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("workOrders");
  const td = useTranslations("demo");
  const { isDemo } = useDemoInfo();
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const total = Number(order.total ?? 0);
  const ticket = order.status === "paid" ? order.ticket : null;
  const { data: terminals = [] } = usePaymentTerminals({ enabled: open && !ticket });
  const [rows, setRows] = useState<Row[]>([emptyRow(0, "cash")]);
  const [idempotencyKey] = useState(newKey);
  const [phone, setPhone] = useState(order.customer_phone ?? "");
  const charge = useChargeOrder(order.id);
  const whatsapp = useMutation({
    mutationFn: ({ id, phone }: { id: number; phone?: string }) => ticketsService.sendWhatsapp(id, phone),
  });

  const single = rows.length === 1;
  // Con un solo pago de tarjeta o transferencia el monto es el total; con varios, cada uno trae el suyo.
  const amountOf = (row: Row) => (single ? total : num(row.amount));
  const nonCash = round(rows.filter((r) => r.method !== "cash").reduce((sum, r) => sum + amountOf(r), 0));
  const cashRow = rows.find((r) => r.method === "cash");
  const cashDue = round(total - nonCash);
  const received = cashRow ? num(cashRow.received) : 0;
  const missing = cashRow ? Math.max(0, round(cashDue - received)) : Math.max(0, cashDue);
  const change = cashRow && received > cashDue ? round(received - cashDue) : 0;
  const exceeds = nonCash > total;
  const defaultTerminal = terminals.length === 1 ? String(terminals[0].id) : "";
  const rowValid = (row: Row) =>
    (row.method === "cash" ? row.received !== "" : single || num(row.amount) > 0) &&
    (row.method !== "card" || terminals.length === 0 || (row.terminalId || defaultTerminal) !== "") &&
    (row.method !== "card" || row.last4 === "" || /^\d{4}$/.test(row.last4)) &&
    (row.method !== "transfer" || row.reference.trim() !== "");
  const canConfirm = !exceeds && missing === 0 && (!cashRow || cashDue > 0) && rows.every(rowValid);

  const patch = (key: number, changes: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  function addRow() {
    const method: PaymentMethod = cashRow ? "card" : "cash";
    setRows((prev) => {
      // El pago que se agrega empieza con lo que falta; el primero conserva el total si aún no tenía monto.
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
      { payments: toPayload(), idempotencyKey },
      {
        onError: (err: Error) => {
          const error = err as AxiosError<{ error?: { details?: { reason?: string; code?: string } } }>;
          const details = error.response?.data?.error?.details;
          if (details?.reason === "no_items") return void toast.error(t("charge.noItems"));
          const code = details?.code;
          toast.error(code && (ERROR_CODES as readonly string[]).includes(code) ? t(`charge.errors.${code}`) : t("charge.error"));
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ticket ? t("charge.success") : t("charge.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("charge.title")}</DialogDescription>
        </DialogHeader>

        {ticket ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Check className="size-6 text-sello" aria-hidden="true" />
              {t("charge.folio", { folio: ticket.folio })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 gap-2" onClick={() => downloadTicketPDF(ticket.id, ticket.folio)}>
                <Download size={16} aria-hidden="true" />
                {t("charge.downloadPdf")}
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="charge-phone">
                {t("charge.phone")}
              </label>
              <div className="flex gap-2">
                <Input id="charge-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("charge.phonePlaceholder")} inputMode="tel" className="h-11" />
                <Button
                  variant="outline"
                  className="h-11 gap-2"
                  disabled={whatsapp.isPending}
                  onClick={() =>
                    whatsapp.mutate(
                      { id: ticket.id, phone: phone || undefined },
                      { onSuccess: () => toast.success(isDemo ? td("simulated") : t("charge.whatsappSent")), onError: () => toast.error(t("charge.whatsappError")) },
                    )
                  }
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  {t("charge.sendWhatsapp")}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button className="h-11" onClick={() => onOpenChange(false)}>
                {t("charge.done")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-center font-display text-5xl font-extrabold tabular-nums">{money.format(total)}</p>

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
                {t("charge.addPayment")}
              </Button>
            )}

            <p aria-live="polite" className="min-h-6 text-base font-semibold tabular-nums">
              {exceeds
                ? t("charge.errors.exceeds_total")
                : missing > 0 && (cashRow ? cashRow.received !== "" : !single)
                  ? t("charge.missing", { amount: money.format(missing) })
                  : cashRow && cashRow.received !== ""
                    ? `${t("charge.change")}: ${money.format(change)}`
                    : null}
            </p>

            <DialogFooter>
              <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button className="h-11" disabled={!canConfirm || charge.isPending} onClick={confirm}>
                {charge.isPending ? t("charge.confirming") : t("charge.confirm")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function emptyRow(key: number, method: PaymentMethod): Row {
  return { key, method, amount: "", received: "", terminalId: "", authorization: "", last4: "", reference: "" };
}

function PaymentRow({
  row,
  index,
  single,
  cashTaken,
  terminals,
  defaultTerminal,
  onChange,
  onRemove,
}: {
  row: Row;
  index: number;
  single: boolean;
  cashTaken: boolean;
  terminals: PaymentTerminal[];
  defaultTerminal: string;
  onChange: (changes: Partial<Row>) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations("workOrders");
  const id = (field: string) => `charge-${row.key}-${field}`;
  const legend = single ? t("charge.method") : t("charge.paymentN", { n: index + 1 });

  return (
    <fieldset className={cn("space-y-3", !single && "rounded-etiqueta border border-border p-3")}>
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium">{legend}</legend>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t("charge.removePayment", { n: index + 1 })} onClick={onRemove}>
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map(({ key, icon: Icon }) => {
          const disabled = key === "cash" && cashTaken;
          return (
            <label key={key} className={cn(disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
              <input
                type="radio"
                name={`payment-method-${row.key}`}
                value={key}
                checked={row.method === key}
                disabled={disabled}
                onChange={() => onChange({ method: key })}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-etiqueta border-2 px-2 py-2 text-sm font-semibold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                  row.method === key ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                )}
              >
                <Icon size={20} aria-hidden="true" />
                {t(`charge.methods.${key}`)}
              </span>
            </label>
          );
        })}
      </div>

      {row.method === "cash" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={id("received")}>
            {t("charge.received")}
          </label>
          <Input
            id={id("received")}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={row.received}
            onChange={(e) => onChange({ received: e.target.value })}
            placeholder={t("charge.receivedPlaceholder")}
            className="h-12 text-lg tabular-nums"
            autoFocus={single}
          />
        </div>
      ) : (
        !single && (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={id("amount")}>
              {t("charge.amount")}
            </label>
            <Input
              id={id("amount")}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={row.amount}
              onChange={(e) => onChange({ amount: e.target.value })}
              className="h-11 tabular-nums"
            />
          </div>
        )
      )}

      {row.method === "card" && (
        <div className="space-y-3">
          {terminals.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={id("terminal")}>
                {t("charge.terminal")}
              </label>
              <Select
                id={id("terminal")}
                value={row.terminalId || defaultTerminal}
                onChange={(e) => onChange({ terminalId: e.target.value })}
              >
                <option value="">{t("charge.pickTerminal")}</option>
                {terminals.map((terminal) => (
                  <option key={terminal.id} value={terminal.id}>
                    {terminal.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={id("authorization")}>
                {t("charge.authorization")}
              </label>
              <Input id={id("authorization")} value={row.authorization} maxLength={12} onChange={(e) => onChange({ authorization: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={id("last4")}>
                {t("charge.last4")}
              </label>
              <Input
                id={id("last4")}
                value={row.last4}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) => onChange({ last4: e.target.value.replace(/\D/g, "") })}
                className="h-11 tabular-nums"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("charge.optionalVoucher")}</p>
        </div>
      )}

      {row.method === "transfer" && (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={id("reference")}>
            {t("charge.reference")}
          </label>
          <Input id={id("reference")} value={row.reference} maxLength={60} onChange={(e) => onChange({ reference: e.target.value })} className="h-11" />
        </div>
      )}
    </fieldset>
  );
}
