"use client";
// Detalle de una venta del historial (spec 050): artículos con el nombre y el precio del momento, pagos, ticket y, para
// dueño y administrador, la cancelación con motivo obligatorio.
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCancelSale, useSale } from "@/hooks/use-sales";
import type { Sale } from "@/types";
import { formatMoney } from "./lib";
import { SaleTicket } from "./sale-ticket";

const DATE_LOCALES = { es, en: enUS };

export function SaleDetailDialog({ saleId, onClose }: { saleId: number | null; onClose: () => void }) {
  const t = useTranslations("pos.history");
  const locale = useLocale() as "es" | "en";
  const { data: sale, isError } = useSale(saleId);
  const [cancelling, setCancelling] = useState(false);

  return (
    <Dialog open={saleId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("detail.title", { id: saleId ?? "" })}</DialogTitle>
          <DialogDescription className="sr-only">{t("detail.title", { id: saleId ?? "" })}</DialogDescription>
        </DialogHeader>
        {isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("detail.loadError")}
          </p>
        ) : sale ? (
          <Body sale={sale} locale={locale} onCancel={() => setCancelling(true)} />
        ) : (
          <div aria-busy className="h-32 animate-pulse rounded-etiqueta bg-muted" />
        )}
        {sale && <CancelDialog sale={sale} open={cancelling} onOpenChange={setCancelling} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ sale, locale, onCancel }: { sale: Sale; locale: "es" | "en"; onCancel: () => void }) {
  const t = useTranslations("pos.history");
  const tw = useTranslations("tickets");
  const fmt = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy HH:mm", { locale: DATE_LOCALES[locale] }) : "");
  const payments = (sale.ticket?.payments ?? []).filter((p) => !p.voided_at);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {sale.ticket?.folio && <span className="mr-2 font-mono font-semibold">{sale.ticket.folio}</span>}
        {sale.status_label} · {fmt(sale.paid_at ?? sale.created_at)}
      </p>
      <p className="text-sm text-muted-foreground">
        {sale.opened_by && t("detail.opened", { name: sale.opened_by.name })}
        {sale.charged_by && ` · ${t("detail.charged", { name: sale.charged_by.name })}`}
        {sale.cancelled_by && ` · ${t("detail.cancelledBy", { name: sale.cancelled_by.name })}`}
      </p>

      <section aria-label={t("detail.items")}>
        <ul className="divide-y divide-border rounded-etiqueta border border-border">
          {(sale.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {item.name} <span className="text-muted-foreground tabular-nums">× {item.quantity}</span>
              </span>
              <span className="tabular-nums">{formatMoney(item.subtotal, locale)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between font-semibold">
          <span>{t("detail.total")}</span>
          <span className="tabular-nums">{formatMoney(sale.total, locale)}</span>
        </p>
      </section>

      {payments.length > 0 && (
        <section aria-label={t("detail.payments")}>
          <ul className="space-y-1 text-sm">
            {payments.map((payment, index) => (
              <li key={payment.id ?? index} className="flex justify-between">
                <span>{tw(`methods.${payment.method}`)}</span>
                <span className="tabular-nums">{formatMoney(payment.amount, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sale.ticket && <SaleTicket sale={sale} />}

      {sale.actions?.includes("cancel") && (
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onCancel}>
            {t("cancel.button")}
          </Button>
        </DialogFooter>
      )}
    </div>
  );
}

function CancelDialog({ sale, open, onOpenChange }: { sale: Sale; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("pos.history.cancel");
  const cancel = useCancelSale();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = reason.trim() === "";

  function confirm() {
    setTouched(true);
    if (missing) return;
    cancel.mutate(
      { saleId: sale.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(t("done"));
          setReason("");
          setTouched(false);
          onOpenChange(false);
        },
        onError: () => toast.error(t("error")),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title", { id: sale.id })}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor={`cancel-reason-${sale.id}`} className="text-sm font-medium">
            {t("reason")}
          </label>
          <textarea
            id={`cancel-reason-${sale.id}`}
            aria-label={t("reason")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            aria-invalid={touched && missing}
            aria-describedby={touched && missing ? `cancel-reason-error-${sale.id}` : undefined}
            className="w-full rounded-etiqueta border border-input bg-card p-2 text-base foco-etiqueta"
          />
          {touched && missing && (
            <p id={`cancel-reason-error-${sale.id}`} role="alert" className="text-sm text-destructive">
              {t("reasonRequired")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            {t("keep")}
          </Button>
          <Button className="h-11" disabled={cancel.isPending} onClick={confirm}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
