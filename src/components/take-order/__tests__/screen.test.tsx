import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Check, TablesResponse } from "@/types";

const replace = vi.fn();
const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push, replace, back: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/restaurant", () => ({
  restaurantService: {
    overview: vi.fn(), openCheck: vi.fn(), getCheck: vi.fn(), addCheckItem: vi.fn(),
    updateCheckItem: vi.fn(), cancelCheck: vi.fn(), removeCheckItem: vi.fn(), sendRound: vi.fn(), addPayment: vi.fn(),
  },
}));
vi.mock("@/services/inventory", () => ({ inventoryService: { menu: vi.fn() } }));
vi.mock("@/hooks/use-payment-terminals", () => ({ usePaymentTerminals: () => ({ data: [] }) }));
vi.mock("@/hooks/use-work-orders", () => ({
  listWorkOrders: vi.fn().mockResolvedValue({ results: [] }),
  useWorkOrder: () => ({ data: undefined, isLoading: false, isError: false }),
  useAddItem: () => ({ mutateAsync: vi.fn() }),
  useUpdateItem: () => ({ mutateAsync: vi.fn() }),
  useDeleteItem: () => ({ mutateAsync: vi.fn() }),
  useCreateWorkOrder: () => ({ mutateAsync: vi.fn() }),
  useFinishOrder: () => ({ mutateAsync: vi.fn() }),
  useChargeOrder: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { restaurantService } from "@/services/restaurant";
import { inventoryService } from "@/services/inventory";
import { TakeOrderScreen } from "../take-order-screen";

const overview: TablesResponse = {
  results: [
    { id: 1, name: "4", active: true, position: 1, check: null },
    {
      id: 2, name: "5", active: true, position: 2,
      check: { id: 20, waiter: { id: 1, name: "Ana" }, opened_at: "", total: "90.00", counts: { new: 0, preparing: 0, ready: 0, delivered: 0 }, mine: false },
    },
  ],
  takeouts: [],
  ready_items: [],
};

const check = (over: Partial<Check> = {}): Check => ({
  id: 10, status: "open", table: { id: 1, name: "4" }, takeout_name: null, waiter: null, opened_at: "",
  total: "0.00", paid: "0.00", balance: "0.00", items: [], payments: [], ticket_id: null,
  allowed_actions: ["add_item", "send", "pay"], ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  useAuthStore.setState({
    selectedCompanyId: 1, role: "staff",
    user: { companies: [{ id: 1, role: "staff", order_mode: "service" }] } as never,
  });
  vi.mocked(restaurantService.overview).mockResolvedValue(overview);
  vi.mocked(inventoryService.menu).mockResolvedValue({
    menu: [{ category: "Antojitos", items: [{ id: 7, name: "Tostada", price: 30 } as never] }],
  });
});

describe("TakeOrderScreen (modo mesas)", () => {
  it("abre la mesa libre y agrega un producto desde la tarjeta", async () => {
    vi.mocked(restaurantService.openCheck).mockResolvedValue(check());
    vi.mocked(restaurantService.getCheck).mockResolvedValue(check());
    vi.mocked(restaurantService.addCheckItem).mockResolvedValue(
      check({ total: "30.00", items: [{ id: 1, name: "Tostada", quantity: 1, unit_price: "30.00", note: null, status: "draft" } as never] }),
    );
    renderWithProviders(<TakeOrderScreen />);

    await userEvent.click(await screen.findByRole("button", { name: /^4, Libre/ }));
    expect(restaurantService.openCheck).toHaveBeenCalledWith({ dining_table_id: 1 });

    await userEvent.click(await screen.findByRole("button", { name: /Tostada/ }));
    await waitFor(() => expect(restaurantService.addCheckItem).toHaveBeenCalledWith(10, { product_id: 7, quantity: 1 }));
  });

  it("muestra las mesas ocupadas con su total", async () => {
    renderWithProviders(<TakeOrderScreen />);
    expect(await screen.findByRole("button", { name: /^5, Ocupada, .*90/ })).toBeInTheDocument();
  });
});

describe("TakeOrderScreen (liberar mesa)", () => {
  const empty = check({ allowed_actions: ["add_item", "send", "pay", "cancel"] });

  async function openFreeTable() {
    vi.mocked(restaurantService.openCheck).mockResolvedValue(empty);
    vi.mocked(restaurantService.getCheck).mockResolvedValue(empty);
    renderWithProviders(<TakeOrderScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /^4, Libre/ }));
  }

  it("libera una mesa abierta sin productos de una vez, sin confirmar", async () => {
    vi.mocked(restaurantService.cancelCheck).mockResolvedValue(check({ status: "cancelled" }));
    await openFreeTable();

    await userEvent.click(await screen.findByRole("button", { name: "Liberar mesa" }));

    await waitFor(() => expect(restaurantService.cancelCheck).toHaveBeenCalledWith(10));
    expect(screen.queryByText("¿Liberar esta mesa?")).not.toBeInTheDocument();
    expect(await screen.findByText("Elige una mesa para ver su orden.")).toBeInTheDocument();
  });

  it("pide confirmar si hay productos sin mandar", async () => {
    const withDraft = check({
      total: "0.00",
      items: [{ id: 1, name: "Tostada", quantity: 1, unit_price: "30.00", note: null, status: "draft" } as never],
      allowed_actions: ["add_item", "send", "pay", "cancel"],
    });
    vi.mocked(restaurantService.openCheck).mockResolvedValue(withDraft);
    vi.mocked(restaurantService.getCheck).mockResolvedValue(withDraft);
    vi.mocked(restaurantService.cancelCheck).mockResolvedValue(check({ status: "cancelled" }));
    renderWithProviders(<TakeOrderScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /^4, Libre/ }));

    await userEvent.click(await screen.findByRole("button", { name: "Liberar mesa" }));
    expect(await screen.findByText("¿Liberar esta mesa?")).toBeInTheDocument();
    expect(restaurantService.cancelCheck).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Liberar" }));
    await waitFor(() => expect(restaurantService.cancelCheck).toHaveBeenCalledWith(10));
  });

  it("no ofrece liberar cuando la API no permite cancelar (ya se mandó algo)", async () => {
    vi.mocked(restaurantService.openCheck).mockResolvedValue(check());
    vi.mocked(restaurantService.getCheck).mockResolvedValue(check());
    renderWithProviders(<TakeOrderScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /^4, Libre/ }));

    await screen.findByText("Toca un producto del menú para agregarlo.");
    expect(screen.queryByRole("button", { name: "Liberar mesa" })).not.toBeInTheDocument();
  });
});

describe("TakeOrderScreen (sin restaurante)", () => {
  it("vuelve al formulario de siempre en modo servicio", async () => {
    vi.mocked(restaurantService.overview).mockRejectedValue(new Error("module_not_in_plan"));
    renderWithProviders(<TakeOrderScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mis-ordenes"));
  });
});

describe("TakeOrderScreen (volver)", () => {
  const back = () => screen.findByRole("button", { name: "Volver" });

  it("vuelve a Restaurante si se llegó desde ahí", async () => {
    search = "from=restaurante";
    renderWithProviders(<TakeOrderScreen />);
    await userEvent.click(await back());
    expect(push).toHaveBeenCalledWith("/restaurante");
  });

  it("ignora un origen desconocido y vuelve a Mis órdenes", async () => {
    search = "from=https://malo.example";
    renderWithProviders(<TakeOrderScreen />);
    await userEvent.click(await back());
    expect(push).toHaveBeenCalledWith("/mis-ordenes");
  });

  it("sin origen vuelve a Mis órdenes", async () => {
    renderWithProviders(<TakeOrderScreen />);
    await userEvent.click(await back());
    expect(push).toHaveBeenCalledWith("/mis-ordenes");
  });
});
