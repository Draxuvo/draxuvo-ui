import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: http }));

import { salesService } from "./sales";

beforeEach(() => {
  vi.resetAllMocks();
  for (const verb of ["get", "post", "patch", "delete"] as const) http[verb].mockResolvedValue({ data: {} });
});

// El cliente de la API no lleva /api/v1 en su baseURL: cada servicio lo escribe en la ruta (Constitución II).
describe("rutas del servicio de ventas (spec 050)", () => {
  it("todas las rutas viven bajo /api/v1/sales", async () => {
    await salesService.list({ status: "paid" });
    await salesService.catalog({ search: "x" });
    await salesService.get(7);
    await salesService.create();
    await salesService.addItem(7, { product_id: 1 });
    await salesService.updateItem(7, 3, 2);
    await salesService.removeItem(7, 3);
    await salesService.discard(7);
    await salesService.charge(7, { lock_version: 1, payments: [] }, "k");
    await salesService.cancel(7, "Error");
    await salesService.ticketPdf(7, "thermal80");
    await salesService.sendTicketWhatsapp(7, "5512345678");

    const urls = Object.values(http).flatMap((fn) => fn.mock.calls.map((call) => call[0] as string));
    expect(urls).toHaveLength(12);
    for (const url of urls) expect(url).toMatch(/^\/api\/v1\/sales(\/|$)/);
  });

  it("usa los verbos y las rutas del contrato", async () => {
    await salesService.catalog({ search: "pluma" });
    expect(http.get).toHaveBeenCalledWith("/api/v1/sales/catalog", { params: { search: "pluma", page: 1, page_size: 24 } });

    await salesService.addItem(7, { barcode: "7509900000001" });
    expect(http.post).toHaveBeenCalledWith("/api/v1/sales/7/items", { barcode: "7509900000001" }, { skipErrorToast: true });

    await salesService.updateItem(7, 3, 2);
    expect(http.patch).toHaveBeenCalledWith("/api/v1/sales/7/items/3", { quantity: 2 });

    await salesService.charge(7, { lock_version: 4, payments: [] }, "llave");
    expect(http.post).toHaveBeenCalledWith(
      "/api/v1/sales/7/charge",
      { lock_version: 4, payments: [] },
      { headers: { "Idempotency-Key": "llave" }, skipErrorToast: true },
    );

    await salesService.ticketPdf(7, "thermal58");
    expect(http.get).toHaveBeenCalledWith("/api/v1/sales/7/ticket.pdf", { params: { paper: "thermal58" }, responseType: "blob" });
  });
});
