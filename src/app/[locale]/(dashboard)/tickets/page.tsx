// src/app/[locale]/(dashboard)/tickets/page.tsx
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
import { ModuleLocked, useModuleLocked } from "@/components/subscription/module-locked";

const STATUS_TABS = ["all", "pending", "paid"] as const;
type Tab = (typeof STATUS_TABS)[number];

export default function TicketsPage() {
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

  const { data: tickets = [], isLoading, isFetching, refetch, error } = useTickets(filters);

  const pendingCount = tickets.filter((t) => t.status === "pending").length;
  const paidCount = tickets.filter((t) => t.status === "paid").length;

  const locked = useModuleLocked("tickets", error);
  if (locked) return <ModuleLocked module="tickets" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-zinc-900">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {t("subtitle", { count: tickets.length })}
            {pendingCount > 0 && (
              <span className="ml-1.5 text-amber-600 font-medium">
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
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {s === "all" ? t("all") : t(`statuses.${s}`)}
            {s === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
            {s === "paid" && (
              <span className="ml-1.5 text-zinc-400">{paidCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* API error banner */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Error al cargar tickets: </span>
          {(error as Error).message}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-100 animate-pulse" />
          ))
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            <Receipt size={36} className="mx-auto mb-3 text-zinc-300" />
            {t("empty")}
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              className="bg-white border border-zinc-200 rounded-xl p-4 cursor-pointer hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold text-zinc-400 font-mono tracking-wide">
                      {ticket.folio}
                    </span>
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                  <p className="font-medium text-zinc-900 truncate">
                    {ticket.work_order?.title ?? t("workOrder")} #{ticket.work_order_id}
                  </p>
                  {ticket.work_order?.employee && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {ticket.work_order.employee.name}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-zinc-900 tabular-nums">
                    ${Number(ticket.total).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
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
