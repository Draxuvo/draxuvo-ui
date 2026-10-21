import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

vi.mock("next/navigation", () => ({ usePathname: () => "/es/empresas" }));

import { SidebarProvider } from "./sidebar-context";
import { SuperAdminSidebar } from "./super-admin-sidebar";

function mount(companies: unknown[]) {
  useAuthStore.setState({
    user: { id: 1, role: "super_admin", companies } as never,
    selectedCompanyId: null,
    role: "super_admin",
    companyView: false,
  });
  renderWithProviders(
    <SidebarProvider>
      <SuperAdminSidebar />
    </SidebarProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("menú del super admin (spec 029)", () => {
  it("ofrece Mi empresa si es administrador o dueño de alguna", () => {
    mount([{ id: 1, role: "staff", name: "A" }, { id: 2, role: "admin", name: "B" }]);
    expect(screen.getAllByRole("link", { name: "Mi empresa" }).length).toBeGreaterThan(0);
  });

  it.each([[[]], [[{ id: 1, role: "staff", name: "A" }]], [[{ id: 1, role: "manager", name: "A" }]]])(
    "no la ofrece sin membresía de administrador o dueño (%j)",
    (companies) => {
      mount(companies);
      expect(screen.queryByRole("link", { name: "Mi empresa" })).not.toBeInTheDocument();
    },
  );
});
