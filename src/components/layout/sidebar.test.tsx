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

describe("menú lateral", () => {
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
