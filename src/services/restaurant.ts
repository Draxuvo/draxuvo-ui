// src/services/restaurant.ts
import { apiClient } from "@/lib/api";
import type {
  Check, DiningTable, PaymentMethod, PaymentResponse, RoundResponse, Station, StationBoard, StationKind, StockAlert, TablesResponse,
} from "@/types";

const base = "/api/v1/restaurant";

export interface StationPayload {
  name: string;
  kind?: StationKind;
  is_default?: boolean;
  active?: boolean;
  position?: number;
}

export interface TablePayload {
  name: string;
  active?: boolean;
  position?: number;
}

export interface CheckPaymentBody {
  method: PaymentMethod;
  amount: string;
  reference?: string;
  amount_received?: string;
  confirm_incomplete?: boolean;
  terminal_id?: number;
}

export const restaurantService = {
  stations: (): Promise<Station[]> =>
    apiClient.get(`${base}/stations`).then((r) => r.data.results),

  createStation: (data: StationPayload): Promise<Station> =>
    apiClient.post(`${base}/stations`, { station: data }).then((r) => r.data),

  updateStation: (id: number, data: Partial<StationPayload>): Promise<Station> =>
    apiClient.patch(`${base}/stations/${id}`, { station: data }).then((r) => r.data),

  tables: (): Promise<DiningTable[]> =>
    apiClient.get(`${base}/tables`).then((r) => r.data.results),

  createTable: (data: TablePayload): Promise<DiningTable> =>
    apiClient.post(`${base}/tables`, { table: data }).then((r) => r.data),

  updateTable: (id: number, data: Partial<TablePayload>): Promise<DiningTable> =>
    apiClient.patch(`${base}/tables/${id}`, { table: data }).then((r) => r.data),

  board: (stationId: number): Promise<StationBoard> =>
    apiClient.get(`${base}/stations/${stationId}/board`).then((r) => r.data),

  advanceItem: (stationId: number, itemId: number): Promise<void> =>
    apiClient.post(`${base}/stations/${stationId}/items/${itemId}/advance`).then((r) => r.data),

  advanceOrder: (stationId: number, kitchenOrderId: number): Promise<void> =>
    apiClient
      .post(`${base}/stations/${stationId}/kitchen_orders/${kitchenOrderId}/advance`)
      .then((r) => r.data),

  stockAlerts: (): Promise<StockAlert[]> =>
    apiClient.get(`${base}/stock_alerts`).then((r) => r.data.results),

  // Operación del servicio (spec 018): plano de mesas y cuentas.
  overview: (): Promise<TablesResponse> => apiClient.get(`${base}/tables`).then((r) => r.data),

  openCheck: (body: { dining_table_id: number } | { takeout_name: string }): Promise<Check> =>
    apiClient.post(`${base}/checks`, body).then((r) => r.data),

  /** Libera la mesa: cancela la cuenta mientras nada se haya mandado a cocina o a la barra. */
  cancelCheck: (id: number): Promise<Check> =>
    apiClient.post(`${base}/checks/${id}/cancel`, {}).then((r) => r.data),

  getCheck: (id: number): Promise<Check> => apiClient.get(`${base}/checks/${id}`).then((r) => r.data),

  addCheckItem: (checkId: number, body: { product_id: number; quantity: number; note?: string }): Promise<Check> =>
    apiClient.post(`${base}/checks/${checkId}/items`, body).then((r) => r.data),

  updateCheckItem: (checkId: number, itemId: number, body: { quantity?: number; note?: string }): Promise<Check> =>
    apiClient.patch(`${base}/checks/${checkId}/items/${itemId}`, body).then((r) => r.data),

  removeCheckItem: (checkId: number, itemId: number): Promise<Check> =>
    apiClient.delete(`${base}/checks/${checkId}/items/${itemId}`).then((r) => r.data),

  /** La misma llave en un reintento nunca duplica la comanda. */
  sendRound: (checkId: number, idempotencyKey: string): Promise<RoundResponse> =>
    apiClient
      .post(`${base}/checks/${checkId}/rounds`, {}, { headers: { "Idempotency-Key": idempotencyKey } })
      .then((r) => r.data),

  addPayment: (checkId: number, body: CheckPaymentBody, idempotencyKey: string): Promise<PaymentResponse> =>
    apiClient
      .post(`${base}/checks/${checkId}/payments`, body, { headers: { "Idempotency-Key": idempotencyKey } })
      .then((r) => r.data),
};
