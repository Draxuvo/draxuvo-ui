import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Company, Subscription } from "@/types";

vi.mock("@/services/companies", () => ({
  companiesService: {
    list: vi.fn().mockResolvedValue({
      results: [
        { id: 1, name: "Volta" },
        { id: 2, name: "Sazón" },
        { id: 3, name: "Aroma" },
      ] as Company[],
    }),
  },
}));
vi.mock("@/services/subscription", () => ({
  getCompanySubscription: vi.fn(),
  cancelCompanySubscription: vi.fn(),
  createCompanyCheckout: vi.fn(),
  updateCompanyTrialPlan: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

import { getCompanySubscription } from "@/services/subscription";
import SuscripcionesPage from "./page";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const subs: Record<number, Partial<Subscription>> = {
  1: { plan: "pro", status: "suspended", active_access: false, suspension_reason: "plan_change", cancels_at: future(20) },
  2: { plan: "pro", status: "trialing", active_access: true, trial_ends_at: future(15) },
  3: { plan: "basic", status: "active", active_access: true, cancel_at_period_end: false, current_period_end: future(25) },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCompanySubscription).mockImplementation(async (id: number) => subs[id] as Subscription);
});

const row = (name: string) => screen.getByText(name).closest("tr")!;

describe("Suscripciones del super admin (spec 031)", () => {
  it("una empresa suspendida se ve como Suspendida con su plan pendiente y la fecha de cancelación", async () => {
    renderWithProviders(<SuscripcionesPage />);

    await screen.findByText("Volta");
    await within(row("Volta")).findByText("Suspendida");
    expect(within(row("Volta")).getByText(/Plan pendiente: pro/)).toBeInTheDocument();
    expect(within(row("Volta")).getByText(/Se cancela el/)).toBeInTheDocument();
  });

  it("el filtro Suspendidas deja solo las suspendidas", async () => {
    renderWithProviders(<SuscripcionesPage />);
    await within((await screen.findByText("Volta")).closest("tr")!).findByText("Suspendida");

    await userEvent.click(screen.getByRole("button", { name: "Suspendidas" }));

    expect(screen.getByText("Volta")).toBeInTheDocument();
    expect(screen.queryByText("Sazón")).not.toBeInTheDocument();
    expect(screen.queryByText("Aroma")).not.toBeInTheDocument();
  });

  it("solo las empresas en prueba ofrecen cambiar el plan de prueba", async () => {
    renderWithProviders(<SuscripcionesPage />);
    await within((await screen.findByText("Sazón")).closest("tr")!).findByText("Trial");

    expect(within(row("Sazón")).getByRole("button", { name: "Cambiar plan de prueba" })).toBeInTheDocument();
    expect(within(row("Volta")).queryByRole("button", { name: "Cambiar plan de prueba" })).not.toBeInTheDocument();
    expect(within(row("Aroma")).queryByRole("button", { name: "Cambiar plan de prueba" })).not.toBeInTheDocument();

    await userEvent.click(within(row("Sazón")).getByRole("button", { name: "Cambiar plan de prueba" }));
    expect(await screen.findByText("Cambiar plan de prueba de Sazón")).toBeInTheDocument();
  });
});
