// src/hooks/use-tickets.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketsService } from "@/services/tickets";
import type { Ticket, TicketFilters } from "@/types";

/** `enabled: false` cuando el módulo está fuera del plan (`useModuleGate`): sin request ni toast. */
export function useTickets(filters?: TicketFilters, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<Ticket[]>({
    queryKey: ["tickets", filters],
    queryFn: () =>
      ticketsService
        .list({ page: 1, ...filters })
        .then((r) => r.results ?? (r as unknown as Ticket[])),
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled,
  });
}

export function useTicket(id: number) {
  return useQuery<Ticket>({
    queryKey: ["tickets", id],
    queryFn: () => ticketsService.getById(id),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useMarkTicketPaid(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ticketsService.markAsPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets", id] });
    },
  });
}

export function useSendTicketWhatsapp(id: number) {
  return useMutation({
    mutationFn: (phone: string) => ticketsService.sendWhatsapp(id, phone),
  });
}
