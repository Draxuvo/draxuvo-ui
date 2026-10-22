import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { TablesResponse } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/es/ordenes",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: () => ({ enabled: true, isLocked: () => false }),
  ModuleLocked: () => <p>Módulo bloqueado</p>,
}));
vi.mock("@/services/restaurant", () => ({ restaurantService: { overview: vi.fn() } }));
vi.mock("@/services/analytics", () => ({ getDashboardStats: vi.fn().mockResolvedValue({ active_modules: [] }) }));
vi.mock("@/services/employees", () => ({ employeesService: { list: vi.fn().mockResolvedValue({ results: [] }) } }));
const summary = vi.hoisted(() => ({
  data: { counts: { open: 0, in_progress: 0, done: 0, paid_today: 0, unassigned: 0 }, to_charge_total: 0 },
}));
vi.mock("@/hooks/use-work-orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-work-orders")>()),
  useWorkOrders: () => ({ data: { results: [], info: { total: 0 } }, isLoading: false, error: null }),
  useWorkOrderSummary: () => ({ data: summary.data, error: null, refetch: vi.fn(), isFetching: false }),
}));

import { restaurantService } from "@/services/restaurant";
import OrdenesPage from "./page";

const counts = { new: 0, preparing: 0, ready: 0, delivered: 0 };
const opened = new Date(Date.now() - 10 * 60_000).toISOString();
const tables: TablesResponse = {
  results: [
    { id: 1, name: "1", active: true, position: 1, state: "occupied", check: { id: 10, opened_at: opened, total: "100.00", waiter: { id: 1, name: "Ana" }, counts, mine: true } },
    { id: 2, name: "2", active: true, position: 2, state: "to_pay", check: { id: 11, opened_at: opened, total: "80.00", waiter: { id: 1, name: "Ana" }, counts, mine: true } },
  ],
  takeouts: [],
  ready_items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    selectedCompanyId: 1,
    role: "owner",
    user: { id: 1, role: "owner", companies: [{ id: 1, role: "owner", name: "Sazón", order_mode: "order" }] },
  } as never);
});

describe("Órdenes en un restaurante con mesas (spec 032)", () => {
  it("se llama Cuentas y separa por cobrar de abiertas, sin el grupo Sin asignar", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(tables);
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("heading", { name: "Cuentas", level: 1 })).toBeInTheDocument();
    const toPay = await screen.findByRole("heading", { name: /Por cobrar/ });
    expect(toPay.closest("section")).toHaveTextContent("Mesa 2");
    expect(toPay.closest("section")).not.toHaveTextContent("Mesa 1");
    const open = screen.getByRole("heading", { name: /^Abiertas/ });
    expect(open.closest("section")).toHaveTextContent("Mesa 1");
    expect(screen.getByRole("heading", { name: "Cobradas hoy (0)" })).toBeInTheDocument();
    expect(screen.queryByText(/Sin asignar/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva cuenta" })).toBeInTheDocument();
  });

  it("una empresa de servicio conserva Órdenes de trabajo y sus grupos", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue({ results: [], takeouts: [], ready_items: [] });
    useAuthStore.setState({ user: { id: 1, role: "owner", companies: [{ id: 1, role: "owner", name: "Volta", order_mode: "service" }] } } as never);
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("heading", { name: "Órdenes de trabajo", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText(/Sin asignar/)).toBeInTheDocument();
  });
});
