import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Sale, SaleItem } from "@/types";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push, back: vi.fn() }), usePathname: () => "/es/venta" }));
vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn().mockResolvedValue({ active_modules: ["inventory", "pos"] }) }));
vi.mock("@/hooks/use-payment-terminals", () => ({ usePaymentTerminals: () => ({ data: [] }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/services/sales", () => ({
  salesService: {
    list: vi.fn(), catalog: vi.fn(), get: vi.fn(), create: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(),
    removeItem: vi.fn(), discard: vi.fn(), charge: vi.fn(),
  },
}));

import { toast } from "sonner";
import { salesService } from "@/services/sales";
import { SaleScreen } from "../sale-screen";

const item = (over: Partial<SaleItem> = {}): SaleItem => ({
  id: 1, product_id: 10, name: "Cuaderno profesional", sku: "PAP-001", unit_price: "42.50", quantity: 1, subtotal: "42.50",
  icon: null, stock: 18, fractional: false, ...over,
});

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 7, status: "open", status_label: "Abierta", total: "0.00", items_count: 0, opened_by: null, charged_by: null, paid_at: null,
  cancelled_at: null, cancelled_by: null, cancel_reason: null, lock_version: 0, created_at: "2026-11-03T10:00:00Z", folio: null,
  actions: ["add_item", "charge", "discard"], items: [], ticket: null, ...over,
});

const page = <T,>(results: T[]) => ({ info: { page_size: 20, page_index: 1, total: results.length, total_pages: 1 }, results });

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({
    user: { id: 1, role: "staff", companies: [{ id: 1, role: "staff", name: "Papelería" }] } as never,
    selectedCompanyId: 1,
    role: "staff",
  });
  vi.mocked(salesService.list).mockResolvedValue(page([]) as never);
  vi.mocked(salesService.catalog).mockResolvedValue(page([]) as never);
  // Una venta recién abierta está vacía; los casos que necesitan renglones ponen su propia respuesta.
  vi.mocked(salesService.get).mockImplementation(async (id) => sale({ id }));
});

describe("caja de venta (spec 050)", () => {
  it("escanear sin venta abierta la abre y agrega el producto por su código", async () => {
    vi.mocked(salesService.create).mockResolvedValue(sale({ id: 12 }));
    vi.mocked(salesService.addItem).mockResolvedValue(sale({ id: 12, total: "42.50", items_count: 1, items: [item()] }));
    renderWithProviders(<SaleScreen />);

    await userEvent.setup().type(screen.getByLabelText("Código de barras"), "7509990000011{Enter}");

    await waitFor(() => expect(salesService.addItem).toHaveBeenCalledWith(12, { barcode: "7509990000011" }));
    expect(salesService.create).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Cuaderno profesional")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cobrar $42.50" })).toBeEnabled();
  });

  it("dos escaneos seguidos usan la misma venta", async () => {
    vi.mocked(salesService.create).mockResolvedValue(sale({ id: 12 }));
    vi.mocked(salesService.addItem).mockResolvedValue(sale({ id: 12, items: [item()], total: "42.50" }));
    renderWithProviders(<SaleScreen />);
    const user = userEvent.setup();
    const field = screen.getByLabelText("Código de barras");

    await user.type(field, "111{Enter}");
    await waitFor(() => expect(salesService.addItem).toHaveBeenCalledTimes(1));
    await user.type(field, "222{Enter}");
    await waitFor(() => expect(salesService.addItem).toHaveBeenCalledTimes(2));

    expect(salesService.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(salesService.addItem).mock.calls.map((c) => c[0])).toEqual([12, 12]);
  });

  it("dos escaneos que llegan casi juntos usan una sola venta, no abren dos", async () => {
    let release: (value: Sale) => void = () => undefined;
    vi.mocked(salesService.create).mockReturnValue(new Promise<Sale>((resolve) => (release = resolve)));
    vi.mocked(salesService.addItem).mockResolvedValue(sale({ id: 12, items: [item()], total: "42.50" }));
    renderWithProviders(<SaleScreen />);

    await userEvent.setup().type(screen.getByLabelText("Código de barras"), "111{Enter}222{Enter}");
    release(sale({ id: 12 }));

    await waitFor(() => expect(salesService.addItem).toHaveBeenCalledTimes(2));
    expect(salesService.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(salesService.addItem).mock.calls.map((c) => c[0])).toEqual([12, 12]);
  });

  it("cobrar muestra el folio y el ticket aunque la venta cobrada llegue con otra versión", async () => {
    vi.mocked(salesService.list).mockResolvedValue(page([sale({ id: 5 })]) as never);
    let charged = false;
    const open = sale({ id: 5, total: "42.50", lock_version: 3, items: [item()] });
    const paid = sale({
      id: 5, status: "paid", status_label: "Cobrada", total: "42.50", lock_version: 4, actions: ["ticket", "cancel"], items: [item()],
      ticket: { id: 9, folio: "T-000009", change_given: "7.50", payments: [] } as never,
    });
    // Como la API real: antes del cobro la venta está abierta y después viene cobrada, con otra versión.
    vi.mocked(salesService.get).mockImplementation(async () => (charged ? paid : open));
    vi.mocked(salesService.charge).mockImplementation(async () => {
      charged = true;
      return { sale: paid, shortages: [] };
    });
    renderWithProviders(<SaleScreen />);
    const user = userEvent.setup();

    await screen.findByText("Cuaderno profesional");
    await user.click(screen.getByRole("button", { name: /^Cobrar/ }));
    await user.type(await screen.findByLabelText("Recibido"), "50");
    await user.click(screen.getByRole("button", { name: "Confirmar cobro" }));

    expect(await screen.findByText("Folio T-000009")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
    // La venta cobrada ya está en caché con la versión nueva y el resultado sigue a la vista.
    await waitFor(() => expect(salesService.charge).toHaveBeenCalledWith(5, { lock_version: 3, payments: [{ method: "cash", amount_received: 50 }] }, expect.any(String)));
    expect(screen.getByText("Folio T-000009")).toBeInTheDocument();
  });

  it("«Nueva venta» deja la caja vacía y no vuelve a elegir una venta abierta", async () => {
    vi.mocked(salesService.list).mockResolvedValue(page([sale({ id: 5 }), sale({ id: 6 })]) as never);
    vi.mocked(salesService.get).mockImplementation(async (id) => sale({ id, total: "9.00", items: [item({ name: `Producto de venta ${id}` })] }));
    renderWithProviders(<SaleScreen />);
    const user = userEvent.setup();

    expect(await screen.findByText("Producto de venta 5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nueva venta" }));

    expect(await screen.findByText("Escanea un producto o búscalo")).toBeInTheDocument();
    expect(screen.queryByText("Producto de venta 5")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Venta 5" })).toBeInTheDocument();
  });

  it("retoma la venta abierta que ya tenía el cajero", async () => {
    vi.mocked(salesService.list).mockResolvedValue(page([sale({ id: 5 })]) as never);
    vi.mocked(salesService.get).mockResolvedValue(sale({ id: 5, total: "42.50", items: [item()] }));
    renderWithProviders(<SaleScreen />);

    expect(await screen.findByText("Cuaderno profesional")).toBeInTheDocument();
    expect(salesService.create).not.toHaveBeenCalled();
  });

  it("un código que no existe avisa y no deja un renglón", async () => {
    vi.mocked(salesService.create).mockResolvedValue(sale({ id: 12 }));
    vi.mocked(salesService.addItem).mockRejectedValue({ response: { data: { error: { details: { code: "product_not_found" } } } } });
    renderWithProviders(<SaleScreen />);

    await userEvent.setup().type(screen.getByLabelText("Código de barras"), "0000{Enter}");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se encontró el producto."));
    expect(screen.getByRole("button", { name: /Cobrar/ })).toBeDisabled();
  });

  it("elegir una tarjeta del catálogo agrega ese producto por su id", async () => {
    vi.mocked(salesService.catalog).mockResolvedValue(
      page([{ id: 10, name: "Cuaderno profesional", sku: "PAP-001", price: "42.50", icon: null, category: null, stock: 18, fractional: false, barcodes: [] }]) as never,
    );
    vi.mocked(salesService.create).mockResolvedValue(sale({ id: 12 }));
    vi.mocked(salesService.addItem).mockResolvedValue(sale({ id: 12, total: "42.50", items: [item()] }));
    renderWithProviders(<SaleScreen />);

    await userEvent.setup().click(await screen.findByRole("button", { name: /Cuaderno profesional/ }));

    await waitFor(() => expect(salesService.addItem).toHaveBeenCalledWith(12, { product_id: 10 }));
  });

  it("cambiar la cantidad y quitar un renglón van a la API", async () => {
    vi.mocked(salesService.list).mockResolvedValue(page([sale({ id: 5 })]) as never);
    vi.mocked(salesService.get).mockResolvedValue(sale({ id: 5, total: "42.50", items: [item()] }));
    vi.mocked(salesService.updateItem).mockResolvedValue(sale({ id: 5, total: "85.00", items: [item({ quantity: 2, subtotal: "85.00" })] }));
    vi.mocked(salesService.removeItem).mockResolvedValue(sale({ id: 5 }));
    renderWithProviders(<SaleScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Sumar uno a Cuaderno profesional" }));
    await waitFor(() => expect(salesService.updateItem).toHaveBeenCalledWith(5, 1, 2));

    await user.click(await screen.findByRole("button", { name: "Quitar Cuaderno profesional" }));
    await waitFor(() => expect(salesService.removeItem).toHaveBeenCalledWith(5, 1));
  });

  it("descartar pide confirmar y luego borra la venta", async () => {
    vi.mocked(salesService.list).mockResolvedValue(page([sale({ id: 5 })]) as never);
    vi.mocked(salesService.get).mockResolvedValue(sale({ id: 5, total: "42.50", items: [item()] }));
    vi.mocked(salesService.discard).mockResolvedValue(undefined);
    renderWithProviders(<SaleScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Descartar venta" }));
    expect(salesService.discard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Descartar" }));

    await waitFor(() => expect(salesService.discard).toHaveBeenCalledWith(5));
  });

  it("con otras ventas abiertas permite cambiar de venta", async () => {
    vi.mocked(salesService.list).mockResolvedValue(page([sale({ id: 5 }), sale({ id: 6 })]) as never);
    vi.mocked(salesService.get).mockImplementation(async (id) => sale({ id, total: "9.00", items: [item({ name: `Producto de venta ${id}` })] }));
    renderWithProviders(<SaleScreen />);
    const user = userEvent.setup();

    expect(await screen.findByText("Producto de venta 5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Venta 6" }));
    expect(await screen.findByText("Producto de venta 6")).toBeInTheDocument();
  });

  it("sin el módulo muestra el bloqueo del plan", async () => {
    vi.mocked(salesService.list).mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { error: { details: { code: "module_not_in_plan", module: "pos" } } } },
    });
    renderWithProviders(<SaleScreen />);

    expect(await screen.findByRole("heading", { name: /no está en tu plan/i })).toBeInTheDocument();
  });

  it("volver lleva al staff a sus órdenes", async () => {
    renderWithProviders(<SaleScreen />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Volver" }));
    expect(push).toHaveBeenCalledWith("/es/mis-ordenes");
  });
});
