// src/components/tickets/ticket-detail.tsx
"use client";
import { useDemoInfo } from "@/hooks/use-demo";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTicket, useSendTicketWhatsapp } from "@/hooks/use-tickets";
import { TicketStatusBadge } from "./ticket-status-badge";
import { downloadTicketPDF } from "@/lib/ticket-pdf";
import { toast } from "sonner";
import { format } from "date-fns";
import { Ban, Download, ExternalLink, Hash, Loader2, MessageCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import type { Ticket } from "@/types";

export function TicketDetail({
  ticket: initial,
  open,
  onClose,
}: {
  ticket: Ticket;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const td = useTranslations("demo");
  const { isDemo } = useDemoInfo();
  const locale = useLocale();
  const role = useAuthStore((s) => s.role);

  const { data: ticket } = useTicket(initial.id);
  const current = ticket ?? initial;
  const activePayments = (current?.payments ?? []).filter((payment) => !payment.voided_at);

  const sendWhatsapp = useSendTicketWhatsapp(current.id);

  const [downloading, setDownloading] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [phone, setPhone] = useState("");

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadTicketPDF(current.id, current.folio);
    } catch {
      toast.error(tc("error"));
    } finally {
      setDownloading(false);
    }
  }

  function openWhatsapp() {
    setPhone(current.work_order?.customer_phone ?? "");
    setShowWhatsapp(true);
  }

  async function handleSendWhatsapp() {
    try {
      await sendWhatsapp.mutateAsync(phone.trim() || undefined);
      toast.success(isDemo ? td("simulated") : t("whatsappSent"));
    } catch {
      toast.error(tc("error"));
    } finally {
      setShowWhatsapp(false);
      setPhone("");
    }
  }

  function handleSkipWhatsapp() {
    setShowWhatsapp(false);
    setPhone("");
  }

  const orderTotal = Number(current.total ?? 0);
  const orderHref = `/${locale}${role === "staff" ? "/mis-ordenes" : "/ordenes"}/${current.work_order_id}`;
  const check = current.check;
  const checkTitle = check
    ? check.table
      ? t("table", { name: check.table })
      : t("takeout", { name: check.takeout_name ?? "" })
    : null;
  const money = (n: number | string | undefined) => `$${Number(n ?? 0).toFixed(2)}`;

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent
          side="right"
          style={{ width: "min(92vw, 640px)", maxWidth: "none" }}
          className="p-0 flex flex-col gap-0"
        >
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-border/60 shrink-0">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-base flex-1">{t("ticketTitle")}</SheetTitle>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0 font-mono">
                <Hash size={11} />
                {current.folio}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <TicketStatusBadge status={current.status} />
              {current.paid_at && (
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(current.paid_at), "dd MMM yyyy")}
                </span>
              )}
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{check ? t("check") : t("workOrder")}</p>
                <p className="text-sm text-foreground">
                  {checkTitle ?? current.work_order?.title ?? `#${current.work_order_id}`}
                </p>
              </div>
              {check?.waiter && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("waiter")}</p>
                  <p className="text-sm text-foreground">{check.waiter.name}</p>
                </div>
              )}
              {current.work_order?.employee && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("employee")}</p>
                  <p className="text-sm text-foreground">{current.work_order.employee.name}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t("issued")}</p>
                <p className="text-sm text-foreground">
                  {format(new Date(current.created_at), "dd MMM yyyy HH:mm")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t("status")}</p>
                <TicketStatusBadge status={current.status} />
              </div>
            </div>

            {/* Voided notice */}
            {current.status === "voided" && (
              <div role="status" className="space-y-1 rounded-xl border border-estado-cancelada-border bg-estado-cancelada px-4 py-3 text-estado-cancelada-foreground">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Ban size={14} aria-hidden="true" />
                  {t("voidedNote")}
                </p>
                {current.voided_by && (
                  <p className="text-xs">{t("voidedBy")}: {current.voided_by.name}</p>
                )}
                {current.voided_at && (
                  <p className="text-xs">{t("voidedAt", { date: format(new Date(current.voided_at), "dd MMM yyyy HH:mm") })}</p>
                )}
                {current.void_reason && (
                  <p className="text-xs">{t("voidReason")}: {current.void_reason}</p>
                )}
              </div>
            )}

            {/* Payment */}
            {current.payment_method && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("paymentMethod")}</p>
                  <p className="text-sm text-foreground">{t(`methods.${current.payment_method}`)}</p>
                </div>
                {current.charged_by && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{t("chargedBy")}</p>
                    <p className="text-sm text-foreground">{current.charged_by.name}</p>
                  </div>
                )}
                {current.payment_method === "cash" && current.amount_received != null && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("amountReceived")}</p>
                      <p className="text-sm tabular-nums text-foreground">{money(current.amount_received)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("changeGiven")}</p>
                      <p className="text-sm tabular-nums text-foreground">{money(current.change_given)}</p>
                    </div>
                  </>
                )}
                {current.paid_at && (
                  <div className="col-span-2 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {t("chargedAt", { date: format(new Date(current.paid_at), "dd MMM yyyy HH:mm") })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Pagos de una cuenta o del cobro de una orden (spec 015); los anulados quedan en la historia */}
            {activePayments.length > 0 && (
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("payments")}
                </p>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {activePayments.map((payment, i) => (
                    <li key={payment.id ?? i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="text-foreground">
                        {t(`methods.${payment.method}`)}
                        {payment.terminal ? ` · ${payment.terminal.name}` : ""}
                        {payment.authorization_code ? ` · ${t("authorization")}: ${payment.authorization_code}` : ""}
                        {payment.card_last4 ? ` · •••• ${payment.card_last4}` : ""}
                        {payment.reference ? ` · ${t("reference")}: ${payment.reference}` : ""}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{money(payment.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Items table */}
            {(current.items ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {t("items")}
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("description")}
                        </th>
                        <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("qty")}
                        </th>
                        <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("unitPrice")}
                        </th>
                        <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {t("subtotal")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.items!.map((item, i) => (
                        <tr key={item.id ?? i} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-3 text-foreground">{item.description}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {item.quantity}
                            {item.unit ? ` ${item.unit}` : ""}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            ${Number(item.unit_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">
                            ${Number(item.subtotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center rounded-xl border border-border bg-card px-5 py-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("total")}
              </span>
              <span className="text-xl font-bold text-foreground tabular-nums">
                ${orderTotal.toFixed(2)}
              </span>
            </div>

            {/* Notes */}
            {current.notes && (
              <div className="rounded-xl bg-muted/50 border border-border/60 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("notes")}</p>
                <p className="text-sm text-foreground leading-relaxed">{current.notes}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="shrink-0 border-t border-border/60 px-6 py-4 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {t("download")}
            </Button>

            {current.work_order_id != null && (
              <Button asChild variant="outline" size="sm" className="gap-2 min-h-11 sm:min-h-0">
                <Link href={orderHref}>
                  <ExternalLink size={14} aria-hidden="true" />
                  {t("viewOrder")}
                </Link>
              </Button>
            )}

            {current.status === "paid" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 ml-auto border-estado-completada-border text-estado-completada-foreground hover:bg-estado-completada"
                onClick={openWhatsapp}
              >
                <MessageCircle size={14} />
                {t("resendWhatsapp")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* WhatsApp dialog: el teléfono viene de la orden y se puede cambiar */}
      <Dialog open={showWhatsapp} onOpenChange={handleSkipWhatsapp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle size={18} className="text-estado-completada-foreground" />
              {t("sendWhatsappTitle")}
            </DialogTitle>
            <DialogDescription>{t("sendWhatsappDesc")}</DialogDescription>
          </DialogHeader>

          <Input
            type="tel"
            placeholder={t("phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendWhatsapp();
            }}
          />

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={handleSkipWhatsapp}>
              {t("whatsappSkip")}
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-success text-success-foreground hover:bg-success/90"
              onClick={handleSendWhatsapp}
              disabled={sendWhatsapp.isPending}
            >
              {sendWhatsapp.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MessageCircle size={14} />
              )}
              {t("send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
