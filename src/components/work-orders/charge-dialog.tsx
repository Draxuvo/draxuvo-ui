"use client";
// Cobrar desde la orden: método, monto recibido y cambio. Al confirmar muestra el folio, el PDF y WhatsApp.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { Banknote, CreditCard, Landmark, Download, MessageCircle, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChargeOrder } from "@/hooks/use-work-orders";
import { useMutation } from "@tanstack/react-query";
import { ticketsService } from "@/services/tickets";
import { downloadTicketPDF } from "@/lib/ticket-pdf";
import type { PaymentMethod, WorkOrder } from "@/types";
import { cn } from "@/lib/utils";

const METHODS: { key: PaymentMethod; icon: typeof Banknote }[] = [
  { key: "cash", icon: Banknote },
  { key: "card", icon: CreditCard },
  { key: "transfer", icon: Landmark },
];

export function ChargeDialog({ order, open, onOpenChange }: { order: WorkOrder; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("workOrders");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const total = Number(order.total ?? 0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [phone, setPhone] = useState(order.customer_phone ?? "");
  const charge = useChargeOrder(order.id);
  const whatsapp = useMutation({
    mutationFn: ({ id, phone }: { id: number; phone?: string }) => ticketsService.sendWhatsapp(id, phone),
  });
  const ticket = order.status === "paid" ? order.ticket : null;

  const receivedNumber = Number(received);
  const missing = method === "cash" ? Math.max(0, total - (Number.isFinite(receivedNumber) ? receivedNumber : 0)) : 0;
  const change = method === "cash" && receivedNumber > total ? receivedNumber - total : 0;
  const canConfirm = method !== "cash" || (received !== "" && missing === 0);

  function confirm() {
    charge.mutate(
      { payment_method: method, ...(method === "cash" ? { amount_received: receivedNumber } : {}) },
      {
        onError: (err: Error) => {
          const error = err as AxiosError<{ error?: { details?: { reason?: string } } }>;
          const code = error.response?.data?.error?.details?.reason ?? "";
          toast.error(code === "no_items" ? t("charge.noItems") : t("charge.error"));
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
                      { onSuccess: () => toast.success(t("charge.whatsappSent")), onError: () => toast.error(t("charge.whatsappError")) },
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

            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("charge.method")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map(({ key, icon: Icon }) => (
                  <label key={key} className="cursor-pointer">
                    <input type="radio" name="payment-method" value={key} checked={method === key} onChange={() => setMethod(key)} className="peer sr-only" />
                    <span
                      className={cn(
                        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-etiqueta border-2 px-2 py-2 text-sm font-semibold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                        method === key ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      <Icon size={20} aria-hidden="true" />
                      {t(`charge.methods.${key}`)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {method === "cash" && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="charge-received">
                  {t("charge.received")}
                </label>
                <Input
                  id="charge-received"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  placeholder={t("charge.receivedPlaceholder")}
                  className="h-12 text-lg tabular-nums"
                  autoFocus
                />
                <p aria-live="polite" className="min-h-6 text-base font-semibold tabular-nums">
                  {received !== "" && (missing > 0 ? t("charge.missing", { amount: money.format(missing) }) : `${t("charge.change")}: ${money.format(change)}`)}
                </p>
              </div>
            )}

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
