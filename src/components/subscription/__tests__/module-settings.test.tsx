import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Subscription } from "@/types";

const auth = vi.hoisted(() => ({ role: "owner" as string }));

vi.mock("@/store/auth", () => ({
  useAuthStore: () => ({ selectedCompanyId: 7, role: auth.role }),
}));
vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn() }));

import { getSubscription } from "@/services/subscription";
import { ModuleSettings } from "../module-settings";

const base = ["employees", "attendance", "inventory"] as const;
const pro = [...base, "work_orders", "tickets", "reports", "restaurant"] as const;

const subscription = (available: readonly string[], active: readonly string[]) =>
  vi.mocked(getSubscription).mockResolvedValue({ plan: "pro", status: "active", available_modules: [...available], active_modules: [...active] } as unknown as Subscription);

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = "owner";
});

describe("módulos de la suscripción en solo lectura (spec 017)", () => {
  it("un plan Pro muestra sus 7 módulos como Activo, sin interruptores", async () => {
    subscription(pro, pro);
    renderWithProviders(<ModuleSettings />);

    expect(await screen.findByText("Restaurante")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getAllByText("Activo")).toHaveLength(7);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("un módulo desactivado aparece como Desactivado", async () => {
    subscription(pro, pro.filter((module) => module !== "tickets"));
    renderWithProviders(<ModuleSettings />);

    const row = (await screen.findByText("Tickets")).closest("li")!;
    expect(row).toHaveTextContent("Desactivado");
    expect(screen.getAllByText("Activo")).toHaveLength(6);
  });

  it("un plan Básico no muestra Restaurante ni ningún módulo de otro plan", async () => {
    subscription(base, base);
    renderWithProviders(<ModuleSettings />);

    expect(await screen.findByText("Inventario")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Restaurante")).not.toBeInTheDocument();
    expect(screen.queryByText(/Disponible en/)).not.toBeInTheDocument();
  });

  it("explica que Draxuvo administra los módulos", async () => {
    subscription(base, base);
    renderWithProviders(<ModuleSettings />);
    expect(await screen.findByText(/Draxuvo los activa y desactiva/)).toBeInTheDocument();
  });

  it("el administrador la ve; el encargado y el operador no", async () => {
    subscription(base, base);
    auth.role = "admin";
    const first = renderWithProviders(<ModuleSettings />);
    expect(await screen.findByText("Inventario")).toBeInTheDocument();
    first.unmount();

    for (const role of ["manager", "staff"]) {
      auth.role = role;
      const view = renderWithProviders(<ModuleSettings />);
      expect(view.container).toBeEmptyDOMElement();
      view.unmount();
    }
  });

  // --- spec 030: Terminales es un módulo de Pro y Empresa ---

  it("Terminales aparece como Activo en un plan Pro y no figura en Básico", async () => {
    subscription([...pro, "terminals"], [...pro, "terminals"]);
    const { unmount } = renderWithProviders(<ModuleSettings />);

    expect(await screen.findByText("Terminales")).toBeInTheDocument();
    expect(screen.getAllByText("Activo")).toHaveLength(8);
    unmount();

    subscription(base, base);
    renderWithProviders(<ModuleSettings />);
    expect(await screen.findByText("Inventario")).toBeInTheDocument();
    expect(screen.queryByText("Terminales")).not.toBeInTheDocument();
  });

  it("un Terminales desactivado por el super admin aparece como Desactivado", async () => {
    const all = [...pro, "terminals"];
    subscription(all, all.filter((module) => module !== "terminals"));
    renderWithProviders(<ModuleSettings />);

    expect(await screen.findByText("Terminales")).toBeInTheDocument();
    expect(screen.getAllByText("Desactivado")).toHaveLength(1);
  });
});
