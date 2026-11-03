"use client";
// Pestaña «Cobradas» de Órdenes y Mis órdenes (spec 051): historial de cobros (tickets) de cualquier origen,
// orden de trabajo o cuenta de mesa. La API ya recorta al staff a sus propios tickets.
// Antes vivía en /tickets y /mis-tickets, que ahora redirigen aquí.
import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { CHIP, CHIP_ON, CHIP_OFF } from "@/components/filters/chip";
import { FilterNotice } from "@/components/filters/filter-notice";
import { SearchInput } from "@/components/filters/search-input";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useTicket } from "@/hooks/use-tickets";
import { ticketsService } from "@/services/tickets";
import { getDashboardStats } from "@/services/analytics";
import { useAuthStore } from "@/store/auth";
import { TICKET_STATUSES, type Ticket, type TicketStatus } from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const DEFAULTS = { status: "", search: "" };
const ALLOWED = { status: TICKET_STATUSES };
const STATUS_TABS = ["all", "pending", "paid", "voided"] as const;

/** Número entero positivo de un parámetro de la URL, o null. */
function positiveInt(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value > 0 ? value : null;
}

export function PaidList({ variant, header }: { variant: "boss" | "staff"; header?: ReactNode }) {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const tf = useTranslations("common.filters");
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, page, setFilter, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, {
    allowed: ALLOWED,
    preserve: ["vista"],
  });

  // Enlace profundo `?ticket=<id>`: abre ese ticket al cargar (spec 051, contracts/ui-routes.md).
  const linkedId = positiveInt(searchParams.get("ticket"));
  const { data: linked } = useTicket(linkedId ?? 0);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const shown = selected ?? (linkedId ? (linked ?? null) : null);

  function closeDetail() {
    setSelected(null);
    if (linkedId) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("ticket");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

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

  // Conteos de las fichas sobre todos los tickets, no sobre la página cargada. El staff no tiene tablero.
  const { data: stats } = useQuery({
    queryKey: ["dashboard", selectedCompanyId],
    queryFn: getDashboardStats,
    staleTime: 0,
    enabled: gate.enabled && variant === "boss",
  });
  const counts: Record<(typeof STATUS_TABS)[number], number | undefined> = {
    all: stats?.tickets?.total,
    pending: stats?.tickets?.pending,
    paid: stats?.tickets?.paid,
    voided: stats?.tickets?.voided,
  };

  if (gate.isLocked(error)) return <ModuleLocked module="tickets" />;

  const applied = [
    filters.status && `${t("status")}: ${t(`statuses.${filters.status as TicketStatus}`)}`,
    filters.search && `"${filters.search}"`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {isFiltered ? tf("results", { count: data?.info?.total ?? 0 }) : t("subtitle", { count: data?.info?.total ?? 0 })}
        </p>
        <Button variant="outline" size="icon" className="size-10" onClick={() => refetch()} disabled={isFetching} aria-label={tc("refresh")}>
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>
      {header}

      {/* Fichas de estado */}
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

      <SearchInput value={filters.search} onSearch={(value) => setFilter("search", value)} placeholder={t("searchPlaceholder")} />

      {isFiltered && <FilterNotice applied={applied} onClear={reset} />}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-etiqueta border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {tc("loadError")}
          <Button variant="outline" className="h-10" onClick={() => refetch()}>
            {tc("retry")}
          </Button>
        </div>
      )}

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
              className="block min-h-16 w-full cursor-pointer rounded-etiqueta border border-transparent bg-card p-4 text-left shadow-etiqueta transition-colors duration-[120ms] ease-etiqueta hover:border-foreground/40 foco-etiqueta"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">{ticket.folio}</span>
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                  <p className="truncate font-medium text-foreground">
                    {ticket.check
                      ? ticket.check.table
                        ? t("table", { name: ticket.check.table })
                        : t("takeout", { name: ticket.check.takeout_name ?? "" })
                      : (ticket.work_order?.title ?? t("workOrder"))}
                  </p>
                  {(ticket.payment_method || ticket.work_order?.employee || ticket.check?.waiter) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        ticket.payment_method && t(`methods.${ticket.payment_method}`),
                        ticket.work_order?.employee?.name ?? ticket.check?.waiter?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-display text-xl font-semibold leading-none tabular-nums text-foreground">${Number(ticket.total).toFixed(2)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{format(new Date(ticket.created_at), "dd MMM yyyy")}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {data?.info && data.info.total > 0 && <Pagination info={data.info} onPageChange={setPage} />}

      {shown && <TicketDetail ticket={shown} open onClose={closeDetail} />}
    </div>
  );
}
