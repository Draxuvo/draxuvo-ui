import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { TablesResponse } from "@/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/es/restaurante" }));
const plan = vi.hoisted(() => ({ modules: ["employees", "inventory", "work_orders", "tickets", "restaurant"] as string[] }));
vi.mock("@/services/subscription", () => ({
  getSubscription: vi.fn().mockImplementation(() => Promise.resolve({ active_modules: plan.modules })),
}));

vi.mock("@/services/restaurant", () => ({ restaurantService: { overview: vi.fn() } }));

import { restaurantService } from "@/services/restaurant";
import { SidebarProvider } from "./sidebar-context";
import { Sidebar } from "./sidebar";

beforeEach(() => {
  vi.mocked(restaurantService.overview).mockResolvedValue({ results: [], takeouts: [], ready_items: [] });
  plan.modules = ["employees", "inventory", "work_orders", "tickets", "restaurant"];
  useAuthStore.setState({
    user: { id: 1, role: "manager", companies: [{ id: 1, role: "manager", name: "Sazón", order_mode: "order" }] } as never,
    selectedCompanyId: 1,
    role: "manager",
  });
});

function mount(role: string) {
  useAuthStore.setState({
    user: { id: 1, role, companies: [{ id: 1, role, name: "Sazón", order_mode: "order" }] } as never,
    selectedCompanyId: 1,
    role: role as never,
    companyView: false,
  });
  renderWithProviders(
    <SidebarProvider>
      <Sidebar />
    </SidebarProvider>,
  );
}

describe("menú lateral: Terminales es un módulo de Pro y Empresa (spec 030)", () => {
  it.each(["owner", "admin"])("%s de una empresa sin el módulo no ve Terminales", async (role) => {
    mount(role);

    await screen.findAllByRole("link", { name: "Personal" });
    // Mientras carga la suscripción el menú no filtra módulos; al llegar, sin el módulo desaparece.
    await waitFor(() => expect(screen.queryByRole("link", { name: "Terminales" })).not.toBeInTheDocument());
  });

  it.each(["owner", "admin"])("%s de una empresa con el módulo ve Terminales", async (role) => {
    plan.modules = [...plan.modules, "terminals"];
    mount(role);

    expect((await screen.findAllByRole("link", { name: "Terminales" })).length).toBeGreaterThan(0);
  });

  it("manager no ve Terminales aunque el módulo esté activo", async () => {
    plan.modules = [...plan.modules, "terminals"];
    mount("manager");

    await screen.findAllByRole("link", { name: "Personal" });
    expect(screen.queryByRole("link", { name: "Terminales" })).not.toBeInTheDocument();
  });
});

describe("menú lateral", () => {
  it.each(["admin", "owner"])("%s ve una sola opción Personal y ninguna Equipo (spec 029)", async (role) => {
    mount(role);

    const links = await screen.findAllByRole("link", { name: "Personal" });
    expect(new Set(links.map((l) => l.getAttribute("href")))).toEqual(new Set(["/es/personal"]));
    expect(screen.queryByRole("link", { name: "Equipo" })).not.toBeInTheDocument();
  });

  it("manager conserva Personal (solo Empleados) y no ve Equipo", async () => {
    mount("manager");

    expect((await screen.findAllByRole("link", { name: "Personal" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Equipo" })).not.toBeInTheDocument();
  });

  it("el super admin dentro de su empresa tiene Volver al panel global; sin vista de empresa no", async () => {
    useAuthStore.setState({
      user: { id: 1, role: "super_admin", companies: [{ id: 1, role: "owner", name: "Sazón" }] } as never,
      selectedCompanyId: 1,
      role: "owner",
      companyView: true,
    });
    renderWithProviders(
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>,
    );

    expect((await screen.findAllByRole("link", { name: "Volver al panel global" })).length).toBeGreaterThan(0);
  });

  it("trae Restaurante y ya no una entrada suelta de Tomar pedido (spec 019)", async () => {
    renderWithProviders(
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>,
    );

    expect((await screen.findAllByRole("link", { name: "Restaurante" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Tomar pedido" })).not.toBeInTheDocument();
  });
});

describe("menú lateral: lenguaje de restaurante (spec 032)", () => {
  it("con mesas dadas de alta la lista de órdenes se llama Cuentas", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue({
      results: [{ id: 1, name: "1", active: true, position: 1, check: null }],
      takeouts: [],
      ready_items: [],
    } as TablesResponse);
    mount("owner");

    expect((await screen.findAllByRole("link", { name: "Cuentas" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Órdenes de trabajo" })).not.toBeInTheDocument();
  });

  it("sin mesas conserva Órdenes de trabajo", async () => {
    mount("owner");

    expect((await screen.findAllByRole("link", { name: "Órdenes de trabajo" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Cuentas" })).not.toBeInTheDocument();
  });
});
