"use client";
// El ticket de una venta cobrada (spec 050): tamaño (carta o rollo térmico de 58 u 80 mm), descargar el PDF, imprimirlo y,
// si la empresa tiene el módulo de WhatsApp, mandarlo al teléfono del cliente. Una venta cancelada lo muestra marcado.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDemoInfo } from "@/hooks/use-demo";
import { PAPERS, downloadSaleTicketPdf, printSaleTicketPdf, readPaper, savePaper } from "@/lib/sale-ticket-pdf";
import { salesService } from "@/services/sales";
import type { Sale, TicketPaper } from "@/types";

export function SaleTicket({ sale }: { sale: Sale }) {
  const t = useTranslations("pos.ticket");
  const td = useTranslations("demo");
  const { isDemo } = useDemoInfo();
  const [paper, setPaper] = useState<TicketPaper>(readPaper);
  const [phone, setPhone] = useState("");
  const folio = sale.ticket?.folio ?? "";

  const download = useMutation({ mutationFn: () => downloadSaleTicketPdf(sale.id, folio, paper), onError: () => toast.error(t("downloadError")) });
  const print = useMutation({ mutationFn: () => printSaleTicketPdf(sale.id, paper), onError: () => toast.error(t("downloadError")) });
  const whatsapp = useMutation({
    mutationFn: () => salesService.sendTicketWhatsapp(sale.id, phone.trim()),
    onSuccess: () => toast.success(isDemo ? td("simulated") : t("sent")),
    onError: () => toast.error(t("error")),
  });

  if (!sale.ticket) return null;

  return (
    <section aria-label={t("title")} className="space-y-3">
      {sale.status === "cancelled" && (
        <p role="status" className="rounded-etiqueta border border-border bg-muted p-3 text-sm font-semibold">
          {t("cancelled")}
          {sale.cancel_reason ? ` · ${t("cancelReason", { reason: sale.cancel_reason })}` : ""}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor={`paper-${sale.id}`} className="text-sm font-medium">
          {t("paper")}
        </label>
        <Select
          id={`paper-${sale.id}`}
          value={paper}
          onChange={(event) => {
            const next = event.target.value as TicketPaper;
            setPaper(next);
            savePaper(next);
          }}
          selectClassName="h-11"
        >
          {PAPERS.map((key) => (
            <option key={key} value={key}>
              {t(`papers.${key}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11 gap-2" disabled={download.isPending} onClick={() => download.mutate()}>
          <Download size={16} aria-hidden />
          {t("download")}
        </Button>
        <Button type="button" variant="outline" className="h-11 gap-2" disabled={print.isPending} onClick={() => print.mutate()}>
          <Printer size={16} aria-hidden />
          {t("print")}
        </Button>
      </div>

      {sale.whatsapp_available && (
        <div className="space-y-1">
          <label htmlFor={`phone-${sale.id}`} className="text-sm font-medium">
            {t("phone")}
          </label>
          <div className="flex gap-2">
            <Input
              id={`phone-${sale.id}`}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t("phonePlaceholder")}
              inputMode="tel"
              className="h-11"
            />
            <Button type="button" variant="outline" className="h-11 gap-2" disabled={!phone.trim() || whatsapp.isPending} onClick={() => whatsapp.mutate()}>
              <MessageCircle size={16} aria-hidden />
              {t("send")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
