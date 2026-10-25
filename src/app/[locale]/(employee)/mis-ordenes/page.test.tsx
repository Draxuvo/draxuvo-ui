import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

let checks: unknown[] = [];
vi.mock("@/components/take-order/open-checks", async (importActual) => ({
  ...(await importActual<typeof import("@/components/take-order/open-checks")>()),
  useOpenChecks: () => checks,
  useClosedChecks: () => [],
}));
vi.mock("@/components/take-order/use-screen-mode", () => ({ useScreenMode: () => ({ mode: "restaurant", ready: true }) }));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: () => ({ enabled: true, isLocked: () => false }),
  ModuleLocked: () => null,
}));
vi.mock("@/hooks/use-work-orders", () => ({
  useWorkOrders: () => ({ data: { results: [] }, isLoading: false, error: null }),
  useStartOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateWorkOrder: () => ({ mutateAsync: vi.fn() }),
  useUpdateWorkOrder: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/components/work-orders/order-form", () => ({ OrderForm: () => null }));

import MisOrdenesPage from "./page";

const check = { id: 31, name: "4", takeout: false, waiter: "Sara", total: 155, openedAt: new Date().toISOString(), mine: true };

beforeEach(() => {
  checks = [];
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
