// src/services/tickets.ts
import { apiClient } from "@/lib/api";
import type { ListParams, PaginatedResponse, Ticket, TicketFilters } from "@/types";

export type TicketListParams = TicketFilters & ListParams;

export const ticketsService = {
  list: ({
    page = 1,
    page_size = 20,
    status,
    search,
  }: TicketListParams = {}): Promise<PaginatedResponse<Ticket>> =>
    apiClient
      .get("/api/v1/tickets", {
        params: { page, page_size, status, search: search?.trim() || undefined },
      })
      .then((r) => r.data),

  getById: (id: number): Promise<Ticket> =>
    apiClient.get(`/api/v1/tickets/${id}`).then((r) => r.data),

  download: (id: number): Promise<Blob> =>
    apiClient
      .get(`/api/v1/tickets/${id}/download`, { responseType: "blob" })
      .then((r) => r.data),

  sendWhatsapp: (id: number, phone?: string): Promise<void> =>
    apiClient
      .post(`/api/v1/tickets/${id}/send_whatsapp`, phone ? { phone } : {}).then((r) => r.data),
};
