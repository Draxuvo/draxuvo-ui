// src/app/[locale]/(employee)/mis-tickets/page.tsx
// Cobros de las órdenes del empleado. Solo lectura: cobrar se hace desde la orden.
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Receipt, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTickets } from "@/hooks/use-tickets";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";

const STATUS_TABS = ["all", "paid", "voided"] as const;
type Tab = (typeof STATUS_TABS)[number];

export default function MisTicketsPage() {
  const t = useTranslations("tickets");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  const { data: tickets = [], isLoading, error } = useTickets({
    status: tab === "all" ? undefined : tab,
    search: debounced || undefined,
  });

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold">{t("myTickets")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle", { count: tickets.length })}</p>
      </header>

      <div role="group" aria-label={t("filterStatus")} className="flex gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={tab === s}
            onClick={() => setTab(s)}
            className={`min-h-11 rounded-full border px-4 text-sm font-medium foco-etiqueta ${
              tab === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {s === "all" ? t("all") : t(`statuses.${s}`)}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-11 pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-etiqueta border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {t("loadError")}
        </p>
      )}

      <ul className="space-y-2">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-etiqueta" />)
        ) : tickets.length === 0 ? (
          <li className="py-16 text-center text-sm text-muted-foreground">
            <Receipt size={36} className="mx-auto mb-3 text-muted-foreground/50" aria-hidden="true" />
            {debounced ? t("emptyFiltered") : t("empty")}
          </li>
        ) : (
          tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/${locale}/mis-ordenes/${ticket.work_order?.id ?? ""}`}
                className="flex min-h-16 items-start justify-between gap-3 rounded-etiqueta border border-border bg-card p-4 foco-etiqueta"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">{ticket.folio}</span>
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                  <p className="truncate font-medium">{ticket.work_order?.title}</p>
                  {ticket.paid_at && <p className="text-xs text-muted-foreground">{format(new Date(ticket.paid_at), "d MMM, HH:mm")}</p>}
                </div>
                <p className="font-display text-lg font-bold tabular-nums">{money.format(Number(ticket.total))}</p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
