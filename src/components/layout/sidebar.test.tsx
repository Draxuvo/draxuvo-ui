import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

vi.mock("next/navigation", () => ({ usePathname: () => "/es/restaurante" }));
vi.mock("@/services/subscription", () => ({
  getSubscription: vi.fn().mockResolvedValue({
    active_modules: ["employees", "inventory", "work_orders", "tickets", "restaurant"],
  }),
}));

import { SidebarProvider } from "./sidebar-context";
import { Sidebar } from "./sidebar";

beforeEach(() => {
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

describe("menú lateral", () => {
  it.each(["admin", "owner"])("%s ve una sola opción Personal y ninguna Equipo (spec 028)", async (role) => {
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
