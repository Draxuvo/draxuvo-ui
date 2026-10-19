// src/services/restaurant.ts
import { apiClient } from "@/lib/api";
import type { DiningTable, Station, StationBoard, StockAlert } from "@/types";

const base = "/api/v1/restaurant";

export interface StationPayload {
  name: string;
  is_default?: boolean;
  active?: boolean;
  position?: number;
}

export interface TablePayload {
  name: string;
  active?: boolean;
  position?: number;
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
};
