import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

let checks: unknown[] = [];
const nav = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
const gate = vi.hoisted(() => ({ ticketsLocked: false }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => "/es/mis-ordenes",
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock("@/services/tickets", () => ({ ticketsService: { list: vi.fn(), getById: vi.fn() } }));
vi.mock("@/services/analytics", () => ({ getDashboardStats: vi.fn() }));
vi.mock("@/components/take-order/open-checks", async (importActual) => ({
  ...(await importActual<typeof import("@/components/take-order/open-checks")>()),
  useOpenChecks: () => checks,
  useClosedChecks: () => [],
}));
vi.mock("@/components/take-order/use-screen-mode", () => ({ useScreenMode: () => ({ mode: "restaurant", ready: true }) }));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: (module: string) => ({ enabled: true, isLocked: (error?: unknown) => (module === "tickets" && gate.ticketsLocked) || !!(error as { locked?: boolean } | undefined)?.locked }),
  ModuleLocked: () => null,
}));
vi.mock("@/hooks/use-work-orders", () => ({
  useWorkOrders: () => ({ data: { results: [] }, isLoading: false, error: null }),
  useStartOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateWorkOrder: () => ({ mutateAsync: vi.fn() }),
  useUpdateWorkOrder: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/components/work-orders/order-form", () => ({ OrderForm: () => null }));

import { ticketsService } from "@/services/tickets";
import MisOrdenesPage from "./page";

const check = { id: 31, name: "4", takeout: false, waiter: "Sara", total: 155, openedAt: new Date().toISOString(), mine: true };

const ticket = { id: 5, folio: "T-000005", status: "paid", total: "120.00", created_at: new Date().toISOString(), payment_method: "cash", work_order: { id: 3, title: "Cambio de pantalla", employee: null }, check: null };

beforeEach(() => {
  vi.clearAllMocks();
  checks = [];
  nav.query = "";
  gate.ticketsLocked = false;
  useAuthStore.setState({ role: "staff", selectedCompanyId: 1 } as never);
  vi.mocked(ticketsService.list).mockResolvedValue({ results: [ticket], info: { total: 1, page_index: 1, page_end: 1 } } as never);
});

describe("Mis órdenes con mesas", () => {
  it("muestra las cuentas abiertas y no el aviso de que no hay órdenes", () => {
    checks = [check];
    renderWithProviders(<MisOrdenesPage />);

    expect(screen.getByRole("link", { name: "Abrir cuenta de 4" })).toBeInTheDocument();
    expect(screen.queryByText("No tienes órdenes asignadas")).not.toBeInTheDocument();
  });

  it("sin órdenes ni cuentas muestra el aviso de siempre", () => {
    renderWithProviders(<MisOrdenesPage />);

    expect(screen.getByText("No tienes órdenes asignadas")).toBeInTheDocument();
    expect(screen.queryByText("Cuentas abiertas")).not.toBeInTheDocument();
  });
});

describe("Mis órdenes y cobradas en una sola entrada (spec 051)", () => {
  it("con el módulo de tickets muestra Activas y Cobradas y un pie hacia las cobradas", async () => {
    renderWithProviders(<MisOrdenesPage />);

    expect(await screen.findByRole("button", { name: "Cobradas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: /Ver cobradas/ })).toHaveAttribute("href", "/es/mis-ordenes?vista=cobradas");
  });

  it("?vista=cobradas lista los tickets del staff sin acciones de jefe", async () => {
    nav.query = "vista=cobradas";
    renderWithProviders(<MisOrdenesPage />);

    expect(await screen.findByText("T-000005")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Anular/ })).not.toBeInTheDocument();
    // El staff no tiene tablero: no se piden conteos por estado.
    const { getDashboardStats } = await import("@/services/analytics");
    expect(getDashboardStats).not.toHaveBeenCalled();
  });

  it("cambiar a Cobradas deja la vista en la URL", async () => {
    renderWithProviders(<MisOrdenesPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Cobradas" }));
    expect(nav.replace).toHaveBeenCalledWith("/es/mis-ordenes?vista=cobradas", { scroll: false });
  });

  it("sin el módulo de tickets (403) no aparece la pestaña, ni el pie, ni un aviso", async () => {
    vi.mocked(ticketsService.list).mockRejectedValue({ locked: true });
    renderWithProviders(<MisOrdenesPage />);

    await screen.findByText("No tienes órdenes asignadas");
    await waitFor(() => expect(ticketsService.list).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Cobradas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver cobradas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
