"use client";
// Cobro de una cuenta de mesa en el panel (spec 018, R9): pagos uno por uno, como en la app. El efectivo da
// cambio; la tarjeta (con la terminal del negocio) y la transferencia piden referencia y no pasan del saldo.
// La cuenta se cierra sola al cubrir el saldo y se ofrece el ticket.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Banknote, Check as CheckIcon, CreditCard, Download, Landmark } from "lucide-react";
import type { AxiosError } from "axios";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePaymentTerminals } from "@/hooks/use-payment-terminals";
import { useApplyCheck } from "@/hooks/use-restaurant";
import { restaurantService, type CheckPaymentBody } from "@/services/restaurant";
import { downloadTicketPDF } from "@/lib/ticket-pdf";
import { cn } from "@/lib/utils";
import type { Check, PaymentMethod, Ticket } from "@/types";

const METHODS: { key: PaymentMethod; icon: typeof Banknote }[] = [
  { key: "cash", icon: Banknote },
  { key: "card", icon: CreditCard },
  { key: "transfer", icon: Landmark },
];

const fixed = (value: number) => value.toFixed(2);
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

function parse(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

export function CheckPaymentDialog({
  check,
  open,
  onOpenChange,
}: {
  check: Check;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("takeOrder.pay");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const apply = useApplyCheck();
  const { data: terminals = [] } = usePaymentTerminals({ enabled: open });
  const balance = Number(check.balance);

  const [method, setMethod] = useState<PaymentMethod>("cash");
  // El monto sugerido es el saldo vigente (cambia al agregar o mandar productos) hasta que la persona lo escribe.
  const [typedAmount, setAmount] = useState<string | null>(null);
  const amount = typedAmount ?? fixed(balance);
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  // La llave del cobro se conserva hasta el 2xx: reintentar por mala red nunca cobra dos veces.
  const [key, setKey] = useState(newKey);

  const due = parse(amount);
  const got = parse(received);
  const covered = due == null ? 0 : Math.min(due, balance);
  const terminal = terminalId || (terminals.length === 1 ? String(terminals[0].id) : "");
  const cashDiff = method === "cash" && got != null ? Math.round((got - covered) * 100) / 100 : null;

  function validate(): string | null {
    if (due == null || due <= 0) return t("errorAmount");
    if (method !== "cash") {
      if (due > balance) return t("errorExceeds");
      if (!reference.trim()) return t("errorReference");
    }
    return null;
  }

  async function submit(confirmIncomplete = false) {
    const invalid = validate();
    if (invalid) return setError(invalid);
    setError(null);
    setBusy(true);
    const body: CheckPaymentBody =
      method === "cash"
        ? { method, amount: fixed(due as number), amount_received: fixed(got ?? (due as number)) }
        : {
            method,
            amount: fixed(due as number),
            reference: reference.trim(),
            ...(method === "card" && terminal ? { terminal_id: Number(terminal) } : {}),
          };
    if (confirmIncomplete) body.confirm_incomplete = true;
    try {
      const result = await restaurantService.addPayment(check.id, body, key);
      setKey(newKey());
      setPending(null);
      setReceived("");
      setReference("");
      setAmount(null);
      // Trae la cuenta con el pago ya registrado.
      void restaurantService.getCheck(check.id).then(apply);
      if (result.ticket) {
        setTicket(result.ticket);
        toast.success(t("paidDone"));
      }
    } catch (err) {
      const e = err as AxiosError<{ error?: { code?: string; details?: { code?: string; pending?: number } } }>;
      const code = e.response?.data?.error?.details?.code ?? e.response?.data?.error?.code;
      if (e.response) setKey(newKey());
      if (code === "incomplete_items") {
        setPending(Number(e.response?.data?.error?.details?.pending ?? 0));
      } else {
        setError(t("error"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title", { name: check.table?.name ?? check.takeout_name ?? "" })}</DialogTitle>
          <DialogDescription className="sr-only">{t("method")}</DialogDescription>
        </DialogHeader>

        {ticket ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <CheckIcon className="size-6 text-sello" aria-hidden />
              {t("ticket", { number: ticket.folio })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="min-h-11 gap-2" onClick={() => downloadTicketPDF(ticket.id, ticket.folio)}>
                <Download size={16} aria-hidden />
                PDF
              </Button>
              <Button className="min-h-11" onClick={() => onOpenChange(false)}>{t("close")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="font-bold tabular-nums">{money.format(Number(check.total))}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t("paid")}</dt><dd className="font-bold tabular-nums">{money.format(Number(check.paid))}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t("balance")}</dt><dd className="font-display text-xl font-extrabold tabular-nums">{money.format(balance)}</dd></div>
            </dl>

            <div role="radiogroup" aria-label={t("method")} className="grid grid-cols-3 gap-2">
              {METHODS.map(({ key: m, icon: Icon }) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm",
                    method === m ? "border-primary bg-primary/10 font-medium" : "border-input hover:bg-accent",
                  )}
                >
                  <Icon size={16} aria-hidden />
                  {t(m)}
                </button>
              ))}
            </div>

            <label className="block space-y-1 text-sm font-medium">
              {t("amount")}
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11" />
            </label>

            {method === "cash" ? (
              <>
                <label className="block space-y-1 text-sm font-medium">
                  {t("received")}
                  <Input inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={fixed(covered)} className="h-11" />
                </label>
                {cashDiff != null && (
                  <p role="status" className={cn("text-sm font-bold", cashDiff < 0 && "text-destructive")}>
                    {cashDiff < 0 ? t("missing", { amount: money.format(-cashDiff) }) : t("change", { amount: money.format(cashDiff) })}
                  </p>
                )}
              </>
            ) : (
              <>
                {method === "card" && terminals.length > 0 && (
                  <label className="block space-y-1 text-sm font-medium">
                    {t("terminal")}
                    <select
                      value={terminal}
                      onChange={(e) => setTerminalId(e.target.value)}
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="">{t("noTerminal")}</option>
                      {terminals.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="block space-y-1 text-sm font-medium">
                  {t("reference")}
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-11" />
                </label>
              </>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {pending != null && (
              <div role="alert" className="space-y-2 rounded-lg border border-warning p-3 text-sm">
                <p>{pending} {t("pendingItems")}</p>
                <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void submit(true)}>
                  {t("chargeAnyway")}
                </Button>
              </div>
            )}
            <Button type="button" className="min-h-11 w-full" disabled={busy || balance <= 0} onClick={() => void submit()}>
              {busy ? t("working") : t("confirm")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
