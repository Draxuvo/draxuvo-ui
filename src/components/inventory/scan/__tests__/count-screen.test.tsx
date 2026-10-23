import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Product, StockCount } from "@/types";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/services/inventory", () => ({
  inventoryService: {
    counts: { list: vi.fn(), create: vi.fn(), get: vi.fn(), scan: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), confirm: vi.fn(), discard: vi.fn() },
  },
}));

import { inventoryService } from "@/services/inventory";
import { CountScreen } from "../count-screen";

const product = (id: number, name: string): Product => ({ id, sku: `S-${id}`, name, barcodes: [`750${id}`], product_type: { counted: true, fractional: false } }) as Product;
const count = (over: Partial<StockCount> = {}): StockCount => ({
  id: 4, name: "Pasillo 3", status: "draft", user: { id: 1, name: "Ana" }, created_at: "2026-10-23T10:00:00Z", confirmed_at: null, items: [], ...over,
});
const row = (id: number, name: string, counted: number, current: number, changed = false) => ({
  product: product(id, name), counted_qty: counted, baseline_stock: changed ? current - 1 : current, current_stock: current, difference: counted - current, changed,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  useAuthStore.setState({ selectedCompanyId: 1 } as never);
  vi.mocked(inventoryService.counts.list).mockResolvedValue({ info: {} as never, results: [count()] });
});

describe("Conteo físico (spec 034)", () => {
  it("sin borradores ofrece empezar uno con nombre", async () => {
    vi.mocked(inventoryService.counts.list).mockResolvedValue({ info: {} as never, results: [] });
    vi.mocked(inventoryService.counts.create).mockResolvedValue(count({ id: 8, name: "Bodega" }));
    vi.mocked(inventoryService.counts.get).mockResolvedValue(count({ id: 8, name: "Bodega" }));
    renderWithProviders(<CountScreen />);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Nombre del conteo"), "Bodega");
    await user.click(screen.getByRole("button", { name: "Empezar conteo" }));

    await waitFor(() => expect(inventoryService.counts.create).toHaveBeenCalledWith("Bodega"));
    expect(await screen.findByLabelText("Código de barras")).toBeInTheDocument();
  });

  it("retoma el borrador más reciente con lo ya contado y cada escaneo se guarda en el servidor", async () => {
    vi.mocked(inventoryService.counts.get).mockResolvedValue(count({ items: [row(1, "Cuaderno", 3, 5)] }));
    vi.mocked(inventoryService.counts.scan).mockResolvedValue(count({ items: [row(1, "Cuaderno", 4, 5)] }));
    renderWithProviders(<CountScreen />);
    const user = userEvent.setup();

    expect(await screen.findByText("Cuaderno")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad contada de Cuaderno")).toHaveValue(3);

    await user.type(screen.getByLabelText("Código de barras"), "7501{Enter}");

    await waitFor(() => expect(inventoryService.counts.scan).toHaveBeenCalledWith(4, "7501", 1));
    await waitFor(() => expect(screen.getByLabelText("Cantidad contada de Cuaderno")).toHaveValue(4));
  });

  it("un código inexistente avisa y no cambia el conteo", async () => {
    vi.mocked(inventoryService.counts.get).mockResolvedValue(count());
    vi.mocked(inventoryService.counts.scan).mockResolvedValue(null);
    renderWithProviders(<CountScreen />);

    await userEvent.setup().type(await screen.findByLabelText("Código de barras"), "0000{Enter}");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ningún producto tiene el código 0000."));
  });

  it("fijar la cantidad manda el valor absoluto y quitar el renglón lo borra", async () => {
    vi.mocked(inventoryService.counts.get).mockResolvedValue(count({ items: [row(1, "Cuaderno", 3, 5)] }));
    vi.mocked(inventoryService.counts.setItem).mockResolvedValue(count({ items: [row(1, "Cuaderno", 9, 5)] }));
    vi.mocked(inventoryService.counts.removeItem).mockResolvedValue(count());
    renderWithProviders(<CountScreen />);
    const user = userEvent.setup();

    const qty = await screen.findByLabelText("Cantidad contada de Cuaderno");
    await user.clear(qty);
    await user.type(qty, "9{Enter}");
    await waitFor(() => expect(inventoryService.counts.setItem).toHaveBeenCalledWith(4, 1, 9));

    await user.click(screen.getByRole("button", { name: "Quitar Cuaderno" }));
    await waitFor(() => expect(inventoryService.counts.removeItem).toHaveBeenCalledWith(4, 1));
  });

  it("revisa las diferencias y confirma el ajuste", async () => {
    vi.mocked(inventoryService.counts.get).mockResolvedValue(count({ items: [row(1, "Cuaderno", 8, 5), row(2, "Lápiz", 1, 4, true)] }));
    vi.mocked(inventoryService.counts.confirm).mockResolvedValue({ count: count({ status: "confirmed" }), adjustments: [], changed_since_baseline: [2] });
    renderWithProviders(<CountScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Revisar y ajustar" }));
    expect(await screen.findByText("Sobran 3")).toBeInTheDocument();
    expect(screen.getByText("Faltan 3")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("cambió mientras contabas");

    await user.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await user.click(await screen.findByRole("button", { name: "Ajustar stock" }));

    await waitFor(() => expect(inventoryService.counts.confirm).toHaveBeenCalledWith(4));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Conteo confirmado y stock ajustado"));
  });

  it("descartar pide confirmar y deja el stock como estaba", async () => {
    vi.mocked(inventoryService.counts.get).mockResolvedValue(count({ items: [row(1, "Cuaderno", 3, 5)] }));
    vi.mocked(inventoryService.counts.discard).mockResolvedValue(undefined);
    renderWithProviders(<CountScreen />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Descartar conteo" }));

    await waitFor(() => expect(inventoryService.counts.discard).toHaveBeenCalledWith(4));
    expect(window.confirm).toHaveBeenCalled();
  });
});
