// src/app/[locale]/(dashboard)/tickets/page.tsx
"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { Receipt, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { TICKET_STATUSES, type Ticket, type TicketStatus } from "@/types";
import { ticketsService } from "@/services/tickets";
import { getDashboardStats } from "@/services/analytics";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { ModuleLocked, useModuleLocked } from "@/components/subscription/module-locked";

const PAGE_SIZE = 20;
const DEFAULTS = { status: "", search: "" };
const ALLOWED = { status: TICKET_STATUSES };
const STATUS_TABS = ["all", "pending", "paid"] as const;

const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";
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

  // Búsqueda: borrador local con debounce de 400 ms hacia la URL.
  const [draft, setDraft] = useState(filters.search);
  const [synced, setSynced] = useState(filters.search);
  if (synced !== filters.search) {
    setSynced(filters.search);
    if (draft.trim() !== filters.search) setDraft(filters.search);
  }
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);
  function handleSearch(value: string) {
    setDraft(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilter("search", value), 400);
  }

  const [selected, setSelected] = useState<Ticket | null>(null);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["tickets", filters, page],
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
  });
  const counts: Record<(typeof STATUS_TABS)[number], number | undefined> = {
    all: stats?.tickets.total,
    pending: stats?.tickets.pending,
    paid: stats?.tickets.paid,
  };

  const locked = useModuleLocked("tickets", error);
  if (locked) return <ModuleLocked module="tickets" />;

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
      <div className="relative w-full sm:max-w-sm">
        <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label={tc("search")}
          placeholder={t("searchPlaceholder")}
          className="bg-card pl-9"
          value={draft}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {isFiltered && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-card px-3 py-2 text-sm shadow-etiqueta"
        >
          <span className="rounded-full bg-ceja px-2 py-0.5 font-medium text-foreground">
            {tf("applied", { filters: applied.join(" · ") })}
          </span>
          <button
            type="button"
            onClick={reset}
            className="rounded-[6px] px-1 font-medium text-foreground underline decoration-border underline-offset-4 outline-none transition-colors duration-[120ms] hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-foreground"
          >
            {tf("clear")}
          </button>
        </div>
      )}

      {/* API error banner */}
      {error && (
        <div role="alert" className="rounded-[6px] border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {tc("loadError")}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} aria-hidden className="h-20 animate-pulse rounded-[6px] bg-card shadow-etiqueta" />
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
              className="block w-full cursor-pointer rounded-[6px] border border-transparent bg-card p-4 text-left shadow-etiqueta outline-none transition-colors duration-[120ms] ease-etiqueta hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground"
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
