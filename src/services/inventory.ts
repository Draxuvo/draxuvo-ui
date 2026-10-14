// src/services/inventory.ts
import { apiClient } from "@/lib/api";
import type {
  ListParams,
  PaginatedResponse,
  Product,
  ProductFilters,
  StockMovement,
} from "@/types";

export type ProductListParams = ProductFilters & ListParams;

export interface ProductPayload {
  sku: string;
  name: string;
  stock?: number;
  min_stock: number;
  unit_cost: number;
  price?: number;
  category?: string;
  description?: string;
  available?: boolean;
}

export interface StockMovementPayload {
  movement_type: "entry" | "exit";
  qty: number;
  note?: string;
}

export const inventoryService = {
  list: ({
    page = 1,
    page_size = 10,
    low_stock,
    out_of_stock,
    available,
    search,
  }: ProductListParams = {}): Promise<PaginatedResponse<Product>> =>
    apiClient
      .get("/api/v1/products", {
        params: {
          page,
          page_size,
          // Solo `true` aplica en la API; `false` se omite salvo en `available`.
          low_stock: low_stock ? "true" : undefined,
          out_of_stock: out_of_stock ? "true" : undefined,
          available: available === undefined ? undefined : String(available),
          search: search?.trim() || undefined,
        },
      })
      .then((r) => r.data),

  getById: (id: number): Promise<Product> =>
    apiClient.get(`/api/v1/products/${id}`).then((r) => r.data),

  create: (data: ProductPayload): Promise<Product> =>
    apiClient.post("/api/v1/products", { product: data }).then((r) => r.data),

  update: (id: number, data: ProductPayload): Promise<Product> =>
    apiClient
      .patch(`/api/v1/products/${id}`, { product: data })
      .then((r) => r.data),

  remove: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/products/${id}`).then((r) => r.data),

  menu: (): Promise<{ menu: import("@/types").MenuCategory[] }> =>
    apiClient.get("/api/v1/products/menu").then((r) => r.data),

  listMovements: (productId: number): Promise<StockMovement[]> =>
    apiClient
      .get(`/api/v1/products/${productId}/stock_movements`)
      .then((r) => r.data),

  addMovement: (
    productId: number,
    data: StockMovementPayload,
  ): Promise<StockMovement> =>
    apiClient
      .post(`/api/v1/products/${productId}/stock_movements`, {
        stock_movement: data,
      })
      .then((r) => r.data),

  downloadTemplate: (): Promise<Blob> =>
    apiClient
      .get("/api/v1/products/template", { responseType: "blob" })
      .then((r) => r.data),

  importFromFile: (file: File): Promise<{ imported: number; errors: string[] }> => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post("/api/v1/products/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
