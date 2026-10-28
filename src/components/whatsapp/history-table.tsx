// src/components/whatsapp/history-table.tsx
// Historial de la configuración de WhatsApp (spec 047): quién cambió qué y cuándo, sin secretos y con los teléfonos
// enmascarados. Solo lo ve el super admin.
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWhatsappEvents } from "@/hooks/use-whatsapp";
import type { WhatsappEvent } from "@/types";

const PAGE_SIZE = 10;

/** Texto corto del cambio: de qué plantilla a cuál, a quién fue la prueba o el motivo de un fallo. */
function useDetail() {
  const t = useTranslations("whatsapp.history");
  const tr = useTranslations("whatsapp.reasons");
  return (event: WhatsappEvent): string | null => {
    const data = event.data as Record<string, unknown>;
    const from = data.from as { name?: string } | boolean | undefined;
    const to = data.to as { name?: string } | boolean | string | undefined;

    if (event.action === "template_changed" && typeof from === "object" && typeof to === "object") {
      return t("detail.template", { from: from?.name ?? "—", to: to?.name ?? "—" });
    }
    if (event.action === "test_sent" && typeof to === "string") return t("detail.to", { to });
    if (typeof data.reason === "string") return tr.has(data.reason) ? tr(data.reason) : tr("unknown");
    if (typeof data.status === "string") return t("detail.status", { status: data.status });
    return null;
  };
}

export function HistoryTable() {
  const t = useTranslations("whatsapp.history");
  const tTypes = useTranslations("whatsapp.types");
  const locale = useLocale();
  const detailOf = useDetail();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useWhatsappEvents(page, PAGE_SIZE);

  const dateLocale = locale === "es" ? es : enUS;
  const pages = data ? Math.max(1, Math.ceil(data.info.total / PAGE_SIZE)) : 1;

  function targetLabel(event: WhatsappEvent) {
    return event.target === "connection" ? t("connectionTarget") : tTypes(`${event.target}.label`);
  }

  return (
    <section aria-labelledby="wa-history-title" className="space-y-3">
      <div>
        <h2 id="wa-history-title" className="font-display text-xl font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" aria-busy="true" />}

      {isError && (
        <div role="alert" className="rounded-etiqueta border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">{t("error")}</p>
          <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {data && data.results.length === 0 && (
        <p className="rounded-etiqueta border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
      )}

      {data && data.results.length > 0 && (
        <div className="overflow-x-auto rounded-etiqueta border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.when")}</TableHead>
                <TableHead>{t("columns.who")}</TableHead>
                <TableHead>{t("columns.what")}</TableHead>
                <TableHead>{t("columns.result")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.results.map((event) => {
                const detail = detailOf(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(event.created_at), "PPp", { locale: dateLocale })}</TableCell>
                    <TableCell>{event.user?.name ?? t("system")}</TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">{t(`actions.${event.action}`, { target: targetLabel(event) })}</span>
                      {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.result === "ok" ? "secondary" : "destructive"}>{t(`results.${event.result}`)}</Badge>
                      {event.meta_code && <span className="ml-2 text-xs text-muted-foreground">{t("metaCode", { code: event.meta_code })}</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {data && pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("previous")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("page", { page, pages })}</span>
          <Button type="button" variant="outline" className="min-h-11" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t("next")}
          </Button>
        </nav>
      )}
    </section>
  );
}
