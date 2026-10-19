import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Plan, Subscription } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/store/auth", () => ({
  useAuthStore: () => ({ selectedCompanyId: 7, role: "owner" }),
}));
vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn(), updateModules: vi.fn() }));
vi.mock("@/services/plans", () => ({ getPlans: vi.fn() }));

import { getPlans } from "@/services/plans";
import { getSubscription } from "@/services/subscription";
import { ModuleSettings } from "../module-settings";

const plan = (key: Plan["key"], modules: Plan["modules"]): Plan => ({
  key, modules, prices: { monthly: { amount_cents: 0, iva_cents: 0, total_cents: 0 }, annual: { amount_cents: 0, iva_cents: 0, total_cents: 0 } },
});
const base = ["employees", "attendance", "inventory"] as const;
const pro = [...base, "work_orders", "tickets", "reports", "restaurant"] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPlans).mockResolvedValue({
    iva_rate: 16,
    modules: [...pro, "whatsapp", "multi_company"],
    plans: [plan("basic", [...base]), plan("pro", [...pro]), plan("enterprise", [...pro, "whatsapp", "multi_company"])],
  } as never);
});

describe("módulos de la suscripción con restaurante", () => {
  it("un plan Pro muestra el módulo Restaurante con su interruptor", async () => {
    vi.mocked(getSubscription).mockResolvedValue({
      plan: "pro", status: "active", available_modules: [...pro], active_modules: [...pro],
    } as unknown as Subscription);
    renderWithProviders(<ModuleSettings />);

    const toggle = await screen.findByRole("switch", { name: /Restaurante/ });
    expect(toggle).toBeChecked();
  });

  it("un plan Básico lo muestra bloqueado y dice en qué planes está", async () => {
    vi.mocked(getSubscription).mockResolvedValue({
      plan: "basic", status: "active", available_modules: [...base], active_modules: [...base],
    } as unknown as Subscription);
    renderWithProviders(<ModuleSettings />);

    expect(await screen.findByText("Restaurante")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /Restaurante/ })).not.toBeInTheDocument();
    expect(screen.getByText("Restaurante").parentElement).toHaveTextContent("Disponible en Pro o Empresa");
  });
});
