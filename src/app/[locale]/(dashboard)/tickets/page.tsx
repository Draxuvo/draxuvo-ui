// src/app/[locale]/(dashboard)/tickets/page.tsx
"use client";
import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { Receipt, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { TICKET_STATUSES, type Ticket, type TicketStatus } from "@/types";
import { ticketsService } from "@/services/tickets";
import { getDashboardStats } from "@/services/analytics";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { FilterNotice } from "@/components/filters/filter-notice";
import { SearchInput } from "@/components/filters/search-input";

const PAGE_SIZE = 20;
const DEFAULTS = { status: "", search: "" };
const ALLOWED = { status: TICKET_STATUSES };
const STATUS_TABS = ["all", "pending", "paid"] as const;

const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta foco-etiqueta";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF = "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground";

export default function TicketsPage() {
  return (
    <Suspense>
      <TicketsContent />
    </Suspense>
  );
}

function TicketsContent() {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const tf = useTranslations("common.filters");
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const { filters, page, setFilter, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, {
    allowed: ALLOWED,
  });

  const [selected, setSelected] = useState<Ticket | null>(null);

  // Puerta del módulo antes de consultar: fuera del plan no hay request ni toast.
  const gate = useModuleGate("tickets");
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["tickets", filters, page],
    enabled: gate.enabled,
    queryFn: () =>
      ticketsService.list({
        page,
        page_size: PAGE_SIZE,
        status: (filters.status || undefined) as TicketStatus | undefined,
        search: filters.search || undefined,
      }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const tickets = data?.results ?? [];

  // Conteos de las pestañas sobre todos los tickets, no sobre la página cargada.
  const { data: stats } = useQuery({
    queryKey: ["dashboard", selectedCompanyId],
    queryFn: getDashboardStats,
    staleTime: 0,
    enabled: gate.enabled,
  });
  const counts: Record<(typeof STATUS_TABS)[number], number | undefined> = {
    all: stats?.tickets.total,
    pending: stats?.tickets.pending,
    paid: stats?.tickets.paid,
  };

  if (gate.isLocked(error)) return <ModuleLocked module="tickets" />;

  const applied = [
    filters.status && `${t("status")}: ${t(`statuses.${filters.status as TicketStatus}`)}`,
    filters.search && `"${filters.search}"`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFiltered
              ? tf("results", { count: data?.info?.total ?? 0 })
              : t("subtitle", { count: data?.info?.total ?? 0 })}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label={tc("refresh")}
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Pestañas de estado */}
      <div role="group" aria-label={t("filterStatus")} className="flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => {
          const value = s === "all" ? "" : s;
          const on = filters.status === value;
          const count = counts[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter("status", value || null)}
              className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
            >
              {s === "all" ? t("all") : t(`statuses.${s}`)}
              {count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    s === "pending" && count > 0 ? "bg-ceja text-foreground" : on ? "text-background/80" : "",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <SearchInput
        value={filters.search}
        onSearch={(value) => setFilter("search", value)}
        placeholder={t("searchPlaceholder")}
      />

      {isFiltered && <FilterNotice applied={applied} onClear={reset} />}

      {/* API error banner */}
      {error && (
        <div role="alert" className="rounded-etiqueta border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {tc("loadError")}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} aria-hidden className="h-20 animate-pulse rounded-etiqueta bg-card shadow-etiqueta" />
          ))
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Receipt size={36} strokeWidth={1.75} aria-hidden className="mx-auto mb-3" />
            {isFiltered ? (
              <>
                <p className="font-medium text-foreground">{tf("noResults")}</p>
                <p className="mt-1">{tf("noResultsHint")}</p>
              </>
            ) : (
              t("empty")
            )}
          </div>
        ) : (
          tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => setSelected(ticket)}
              className="block w-full cursor-pointer rounded-etiqueta border border-transparent bg-card p-4 text-left shadow-etiqueta transition-colors duration-[120ms] ease-etiqueta hover:border-foreground/40 foco-etiqueta"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">
                      {ticket.folio}
                    </span>
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                  <p className="truncate font-medium text-foreground">
                    {ticket.work_order?.title ?? t("workOrder")} #{ticket.work_order_id}
                  </p>
                  {ticket.work_order?.employee && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{ticket.work_order.employee.name}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-display text-xl font-semibold leading-none tabular-nums text-foreground">
                    ${Number(ticket.total).toFixed(2)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {format(new Date(ticket.created_at), "dd MMM yyyy")}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {data?.info && data.info.total > 0 && (
        <Pagination info={data.info} onPageChange={setPage} />
      )}

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
