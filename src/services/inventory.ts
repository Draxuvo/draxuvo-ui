// src/services/inventory.ts
import { apiClient } from "@/lib/api";
import type {
  ListParams,
  PaginatedResponse,
  Product,
  ProductFilters,
  ProductImport,
  StockCount,
  StockMovement,
  StockReceiptItem,
} from "@/types";

export type ProductListParams = ProductFilters & ListParams;

export interface ProductPayload {
  sku: string;
  name: string;
  stock?: number;
  min_stock?: number;
  unit_cost: number;
  price?: number;
  category?: string;
  description?: string;
  available?: boolean;
  station_id?: number | null;
  product_type_id?: number;
  unit_key?: string | null;
  icon?: string | null;
  /** Lista completa de códigos de barras: reemplaza a la anterior (spec 034). */
  barcodes?: string[];
}

export interface StockMovementPayload {
  movement_type: "entry" | "exit";
  /** Con decimales solo en tipos que los admiten (spec 016). */
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
    product_type_id,
    sellable,
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
          product_type_id: product_type_id || undefined,
          sellable: sellable ? "true" : undefined,
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

  /** Producto por código de barras o SKU exacto; `null` si no existe (spec 034). */
  byCode: (code: string): Promise<Product | null> =>
    apiClient
      .get("/api/v1/products/by_code", { params: { code }, validateStatus: (s) => s === 200 || s === 404 })
      .then((r) => (r.status === 200 ? r.data : null)),

  /** Excel con el inventario y los mismos filtros del listado. */
  exportProducts: ({ search, low_stock, out_of_stock, available, product_type_id }: ProductListParams = {}): Promise<Blob> =>
    apiClient
      .get("/api/v1/products/export", {
        params: {
          search: search?.trim() || undefined,
          low_stock: low_stock ? "true" : undefined,
          out_of_stock: out_of_stock ? "true" : undefined,
          available: available === undefined ? undefined : String(available),
          product_type_id: product_type_id || undefined,
        },
        responseType: "blob",
      })
      .then((r) => r.data),

  /** Sube el archivo y responde 202 con la importación en cola. */
  startImport: (file: File): Promise<ProductImport> => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post("/api/v1/products/import", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },

  getImport: (id: number): Promise<ProductImport> =>
    apiClient.get(`/api/v1/product_imports/${id}`).then((r) => r.data),

  listImports: (params: { active?: boolean; page?: number; page_size?: number } = {}): Promise<PaginatedResponse<ProductImport>> =>
    apiClient
      .get("/api/v1/product_imports", { params: { ...params, active: params.active ? "true" : undefined } })
      .then((r) => r.data),

  /** Entradas de varios productos en una sola operación; la llave evita duplicar un reintento. */
  receive: (
    items: StockReceiptItem[],
    idempotencyKey: string,
    note?: string,
  ): Promise<{ movements: StockMovement[]; products: Product[] }> =>
    apiClient
      .post("/api/v1/stock_receipts", { items, note }, { headers: { "Idempotency-Key": idempotencyKey } })
      .then((r) => r.data),

  counts: {
    list: (status?: string): Promise<PaginatedResponse<StockCount>> =>
      apiClient.get("/api/v1/stock_counts", { params: { status, page_size: 20 } }).then((r) => r.data),
    create: (name?: string): Promise<StockCount> =>
      apiClient.post("/api/v1/stock_counts", { name }).then((r) => r.data),
    get: (id: number): Promise<StockCount> => apiClient.get(`/api/v1/stock_counts/${id}`).then((r) => r.data),
    /** Suma `qty` (1 por defecto) a lo contado del producto del código; `null` si el código no existe. */
    scan: (id: number, code: string, qty = 1): Promise<StockCount | null> =>
      apiClient
        .post(`/api/v1/stock_counts/${id}/scan`, { code, qty }, { validateStatus: (s) => s === 200 || s === 404 })
        .then((r) => (r.status === 200 ? r.data : null)),
    setItem: (id: number, productId: number, countedQty: number): Promise<StockCount> =>
      apiClient.patch(`/api/v1/stock_counts/${id}/items/${productId}`, { counted_qty: countedQty }).then((r) => r.data),
    removeItem: (id: number, productId: number): Promise<StockCount> =>
      apiClient.delete(`/api/v1/stock_counts/${id}/items/${productId}`).then((r) => r.data),
    confirm: (id: number): Promise<{ count: StockCount; adjustments: StockMovement[]; changed_since_baseline: number[] }> =>
      apiClient.post(`/api/v1/stock_counts/${id}/confirm`).then((r) => r.data),
    discard: (id: number): Promise<void> => apiClient.delete(`/api/v1/stock_counts/${id}`).then(() => undefined),
  },
};
