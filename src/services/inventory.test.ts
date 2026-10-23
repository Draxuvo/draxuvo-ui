import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import { apiClient } from "@/lib/api";
import { inventoryService } from "./inventory";

beforeEach(() => vi.clearAllMocks());

describe("inventoryService (spec 034)", () => {
  it("exporta con los mismos filtros del listado y pide un blob", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: new Blob(["x"]) });

    await inventoryService.exportProducts({ search: " tornillo ", low_stock: true, product_type_id: 3 });

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/products/export", {
      params: { search: "tornillo", low_stock: "true", out_of_stock: undefined, available: undefined, product_type_id: 3 },
      responseType: "blob",
    });
  });

  it("byCode devuelve el producto o null cuando el código no existe", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 200, data: { id: 1, sku: "A" } });
    expect(await inventoryService.byCode("123")).toMatchObject({ id: 1 });

    vi.mocked(apiClient.get).mockResolvedValueOnce({ status: 404, data: {} });
    expect(await inventoryService.byCode("999")).toBeNull();
  });

  it("la recepción manda las líneas con la llave de idempotencia", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { movements: [], products: [] } });

    await inventoryService.receive([{ product_id: 1, qty: 2 }], "key-1", "Factura");

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/stock_receipts",
      { items: [{ product_id: 1, qty: 2 }], note: "Factura" },
      { headers: { "Idempotency-Key": "key-1" } },
    );
  });
});
