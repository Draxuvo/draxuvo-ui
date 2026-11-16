import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

// Spec 063 (US2, US3): Draxuvo solo en el panel global del super admin; con empresa activa, la marca de la empresa.
vi.mock("next/navigation", () => ({ usePathname: () => "/es/inicio" }));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/alerts/alert-bell", () => ({ AlertBell: () => null }));
vi.mock("@/components/charge-queue/charge-queue-chip", () => ({ ChargeQueueChip: () => null }));
vi.mock("@/components/attendance/attendance-button", () => ({ AttendanceButton: () => null }));
vi.mock("@/components/attendance/logout-dialog", () => ({ useLogoutFlow: () => ({ requestLogout: vi.fn(), dialog: null }) }));
vi.mock("./locale-switcher", () => ({ LocaleSwitcher: () => null }));
vi.mock("./company-switcher", () => ({ CompanySwitcher: () => null }));

import { SidebarProvider } from "./sidebar-context";
import { Header } from "./header";

const company = { id: 23, name: "Aquí me quedo", role: "admin", logo_url: "https://api.test/logo.webp" };

function mount(state: Record<string, unknown>) {
  useAuthStore.setState(state as never);
  renderWithProviders(
    <SidebarProvider>
      <Header />
    </SidebarProvider>,
  );
}

describe("marca del encabezado (spec 063)", () => {
  it("el administrador ve el logo y el nombre de su empresa, no Draxuvo", () => {
    mount({ user: { id: 1, role: "staff", companies: [company] }, selectedCompanyId: 23, role: "admin", companyView: false });
    expect(screen.getByText("Aquí me quedo")).toBeInTheDocument();
    expect(screen.getByTestId("company-mark").querySelector("img")).toHaveAttribute("src", company.logo_url);
    expect(screen.queryByText("Draxuvo")).not.toBeInTheDocument();
  });

  it("el super admin en su panel global ve Draxuvo", () => {
    mount({ user: { id: 2, role: "super_admin", companies: [company] }, selectedCompanyId: null, role: "super_admin", companyView: false });
    expect(screen.getByText("Draxuvo")).toBeInTheDocument();
    expect(screen.queryByTestId("company-mark")).not.toBeInTheDocument();
  });

  it("el super admin dentro de la vista de una empresa ve la marca de esa empresa", () => {
    mount({ user: { id: 2, role: "super_admin", companies: [company] }, selectedCompanyId: 23, role: "admin", companyView: true });
    expect(screen.getByText("Aquí me quedo")).toBeInTheDocument();
    expect(screen.queryByText("Draxuvo")).not.toBeInTheDocument();
  });
});
