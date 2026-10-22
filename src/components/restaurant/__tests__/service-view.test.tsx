import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { TablesResponse } from "@/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/restaurant", () => ({
  restaurantService: { overview: vi.fn(), openCheck: vi.fn() },
}));

import { restaurantService } from "@/services/restaurant";
import { ServiceView } from "../service-view";

const counts = { new: 0, preparing: 0, ready: 0, delivered: 0 };
const response = (extra: Partial<TablesResponse> = {}): TablesResponse => ({
  results: [
    { id: 1, name: "1", active: true, position: 1, state: "occupied", check: { id: 10, opened_at: new Date(Date.now() - 20 * 60_000).toISOString(), total: "155.00", waiter: { id: 1, name: "Ana" }, counts, mine: true } },
    { id: 2, name: "2", active: true, position: 2, state: "to_pay", check: { id: 11, opened_at: new Date(Date.now() - 50 * 60_000).toISOString(), total: "80.00", waiter: { id: 2, name: "Luis" }, counts, mine: false } },
    { id: 3, name: "3", active: true, position: 3, state: "free", check: null },
    { id: 4, name: "4", active: false, position: 4, state: "free", check: null },
  ],
  takeouts: [{ id: 12, takeout_name: "Luisa", opened_at: new Date(Date.now() - 5 * 60_000).toISOString(), total: "40.00", counts, mine: false }],
  ready_items: [],
  overview: { open_checks: 3, to_pay_total: "80.00", pending_comandas: 2, oldest_open_minutes: 50 },
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ selectedCompanyId: 1, role: "manager" } as never);
  vi.mocked(restaurantService.overview).mockResolvedValue(response());
});

describe("ServiceView", () => {
  it("pinta el plano con estado, tiempo y total, y deja fuera las mesas inactivas", async () => {
    renderWithProviders(<ServiceView enabled />);

    expect(await screen.findByRole("button", { name: /^Mesa 1, Ocupada, 20 min abierta, \$155\.00/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Mesa 2, Por cobrar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mesa 3, Libre" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mesa 4/ })).not.toBeInTheDocument();
    expect(screen.getByText("Para llevar", { selector: "h2" })).toBeInTheDocument();
  });

  it("el resumen muestra las cuatro cifras", async () => {
    renderWithProviders(<ServiceView enabled />);

    const summary = await screen.findByRole("list", { name: "Resumen del servicio" }).catch(() => null);
    expect(summary ?? (await screen.findByText("Cuentas abiertas"))).toBeTruthy();
    expect(screen.getByText("Por cobrar", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("$80.00", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Comandas pendientes")).toBeInTheDocument();
    expect(screen.getByText("50 min", { selector: "dd" })).toBeInTheDocument();
  });

  it("sin overview (quien no es jefe) no hay resumen", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(response({ overview: undefined }));
    renderWithProviders(<ServiceView enabled />);

    await screen.findByRole("button", { name: "Mesa 3, Libre" });
    expect(screen.queryByText("Cuentas abiertas")).not.toBeInTheDocument();
  });

  it("una cuenta ajena sin total no muestra dinero", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(
      response({
        results: [{ id: 2, name: "2", active: true, position: 2, state: "occupied", check: { id: 11, opened_at: new Date().toISOString(), counts, mine: false } }],
        takeouts: [],
        overview: undefined,
      }),
    );
    renderWithProviders(<ServiceView enabled />);

    const tile = await screen.findByRole("button", { name: /^Mesa 2, Ocupada/ });
    expect(tile.textContent).not.toMatch(/\$/);
  });

  it("tocar una mesa ocupada abre su cuenta", async () => {
    renderWithProviders(<ServiceView enabled />);

    await userEvent.setup().click(await screen.findByRole("button", { name: /^Mesa 1, Ocupada/ }));
    expect(push).toHaveBeenCalledWith("/es/pedido?cuenta=10&from=restaurante");
  });

  it("tocar una mesa libre abre una cuenta nueva y la muestra", async () => {
    vi.mocked(restaurantService.openCheck).mockResolvedValue({ id: 99 } as never);
    renderWithProviders(<ServiceView enabled />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Mesa 3, Libre" }));
    await waitFor(() => expect(restaurantService.openCheck).toHaveBeenCalledWith({ dining_table_id: 3 }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/es/pedido?cuenta=99&from=restaurante"));
  });

  it("sin mesas guía a configurarlas", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(response({ results: [], takeouts: [] }));
    const onConfigure = vi.fn();
    renderWithProviders(<ServiceView enabled onConfigure={onConfigure} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Configurar mesas" }));
    expect(onConfigure).toHaveBeenCalledOnce();
  });
});
