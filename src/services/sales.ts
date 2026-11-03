// src/services/sales.ts — venta de mostrador (spec 050, contracts/api.md).
import { apiClient } from "@/lib/api";
import type {
  ChargePaymentInput,
  ListParams,
  PaginatedResponse,
  Sale,
  SaleCatalogProduct,
  SaleChargeResult,
  SalesFilters,
  TicketPaper,
} from "@/types";

export type SalesListParams = SalesFilters & ListParams;

/** Qué producto se agrega: por id, por código de barras o por clave. */
export type AddItemInput = { product_id: number; quantity?: number } | { barcode: string; quantity?: number } | { sku: string; quantity?: number };

export const salesService = {
  list: ({ page = 1, page_size = 20, ...filters }: SalesListParams = {}) =>
    apiClient.get<PaginatedResponse<Sale>>("/api/v1/sales", { params: { page, page_size, ...filters } }).then((r) => r.data),

  catalog: ({ search, page = 1, page_size = 24 }: { search?: string; page?: number; page_size?: number } = {}) =>
    apiClient
      .get<PaginatedResponse<SaleCatalogProduct>>("/api/v1/sales/catalog", { params: { search: search || undefined, page, page_size } })
      .then((r) => r.data),

  get: (id: number) => apiClient.get<Sale>(`/api/v1/sales/${id}`).then((r) => r.data),

  create: () => apiClient.post<Sale>("/api/v1/sales").then((r) => r.data),

  addItem: (id: number, input: AddItemInput) =>
    apiClient.post<Sale>(`/api/v1/sales/${id}/items`, input, { skipErrorToast: true }).then((r) => r.data),

  updateItem: (id: number, itemId: number, quantity: number) =>
    apiClient.patch<Sale>(`/api/v1/sales/${id}/items/${itemId}`, { quantity }).then((r) => r.data),

  removeItem: (id: number, itemId: number) => apiClient.delete<Sale>(`/api/v1/sales/${id}/items/${itemId}`).then((r) => r.data),

  discard: (id: number) => apiClient.delete(`/api/v1/sales/${id}`).then(() => undefined),

  charge: (id: number, payload: { lock_version: number; payments: ChargePaymentInput[] }, idempotencyKey: string) =>
    apiClient
      .post<SaleChargeResult>(`/api/v1/sales/${id}/charge`, payload, { headers: { "Idempotency-Key": idempotencyKey }, skipErrorToast: true })
      .then((r) => r.data),

  /** Cancela una venta cobrada (solo dueño y administrador). */
  cancel: (id: number, reason: string) => apiClient.post<Sale>(`/api/v1/sales/${id}/cancel`, { reason }, { skipErrorToast: true }).then((r) => r.data),

  /** PDF del ticket de una venta cobrada. */
  ticketPdf: (id: number, paper: TicketPaper) =>
    apiClient.get<Blob>(`/api/v1/sales/${id}/ticket.pdf`, { params: { paper }, responseType: "blob" }).then((r) => r.data),

  sendTicketWhatsapp: (id: number, phone: string) =>
    apiClient.post<{ message: string; demo?: boolean }>(`/api/v1/sales/${id}/ticket/whatsapp`, { phone }, { skipErrorToast: true }).then((r) => r.data),
};
