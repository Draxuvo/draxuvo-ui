import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

const plan = vi.hoisted(() => ({ modules: [] as string[] }));
const list = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/es/terminales" }));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/services/subscription", () => ({
  getSubscription: vi.fn().mockImplementation(() => Promise.resolve({ active_modules: plan.modules })),
}));
vi.mock("@/services/payment-terminals", () => ({ paymentTerminalsService: { list } }));

import TerminalesPage from "../../app/[locale]/(dashboard)/terminales/page";

beforeEach(() => {
  list.mockReset().mockResolvedValue([{ id: 1, name: "BBVA caja 1", provider: "bbva", provider_label: "BBVA", active: true, payments_count: 0 }]);
  useAuthStore.setState({
    user: { id: 1, role: "owner", companies: [{ id: 1, role: "owner", name: "Volta" }] } as never,
    selectedCompanyId: 1,
    role: "owner",
    companyView: false,
  });
});

describe("página Terminales (spec 030)", () => {
  it("en una empresa sin el módulo muestra el bloqueo y no pide terminales", async () => {
    plan.modules = ["employees", "inventory"];
    renderWithProviders(<TerminalesPage />);

    expect(await screen.findByText("Este módulo no está en tu plan")).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it("en una empresa con el módulo lista sus terminales", async () => {
    plan.modules = ["employees", "inventory", "terminals"];
    renderWithProviders(<TerminalesPage />);

    expect(await screen.findByText("BBVA caja 1")).toBeInTheDocument();
    expect(screen.queryByText("Este módulo no está en tu plan")).not.toBeInTheDocument();
  });
});
