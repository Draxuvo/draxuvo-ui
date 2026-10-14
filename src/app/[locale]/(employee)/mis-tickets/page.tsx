// src/app/[locale]/(employee)/mis-tickets/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTickets } from "@/hooks/use-tickets";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { Receipt, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { Ticket } from "@/types";

const STATUS_TABS = ["all", "pending", "paid"] as const;
type Tab = (typeof STATUS_TABS)[number];

export default function MisTicketsPage() {
  const t = useTranslations("tickets");

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(id);
  }, [search]);

  const filters = {
    status: tab === "all" ? undefined : tab,
    search: debouncedSearch || undefined,
  };

  const { data: tickets = [], isLoading, isFetching, refetch, error } =
    useTickets(filters);

  const pendingCount = tickets.filter((t) => t.status === "pending").length;
  const paidCount = tickets.filter((t) => t.status === "paid").length;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-foreground">{t("myTickets")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle", { count: tickets.length })}
            {pendingCount > 0 && (
              <span className="ml-1.5 text-estado-pendiente-foreground font-medium">
                · {t("pendingCount", { count: pendingCount })}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tab === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-border"
            }`}
          >
            {s === "all" ? t("all") : t(`statuses.${s}`)}
            {s === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-warning text-warning-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
            {s === "paid" && (
              <span className="ml-1.5 text-muted-foreground">{paidCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* API error */}
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="font-semibold">Error: </span>
          {(error as Error).message}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Receipt size={36} className="mx-auto mb-3 text-muted-foreground/50" />
            {t("empty")}
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground font-mono tracking-wide">
                      {ticket.folio}
                    </span>
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                  <p className="font-medium text-foreground truncate">
                    {ticket.work_order?.title ?? t("workOrder")} #{ticket.work_order_id}
                  </p>
                  {ticket.work_order?.employee && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ticket.work_order.employee.name}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-foreground tabular-nums">
                    ${Number(ticket.total).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {format(new Date(ticket.created_at), "dd MMM yyyy")}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <TicketDetail
          ticket={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
