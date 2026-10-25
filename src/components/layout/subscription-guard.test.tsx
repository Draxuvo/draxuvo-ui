import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Subscription } from "@/types";

const path = vi.hoisted(() => ({ value: "/es/inicio" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));
vi.mock("./company-switcher", () => ({ CompanySwitcher: () => null, useSwitchCompany: () => vi.fn() }));
vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: { get: vi.fn() }, expectModuleLock: () => () => {} }));

import { apiClient } from "@/lib/api";
import { getSubscription } from "@/services/subscription";
import { SubscriptionGuard } from "./subscription-guard";

const suspended = {
  plan: "pro",
  status: "suspended",
  active_access: false,
  suspension_reason: "plan_change",
  cancels_at: "2026-11-21T10:00:00Z",
  pay_url: "https://invoice.stripe.com/i/guard",
} as unknown as Subscription;

function as(role: string) {
  useAuthStore.setState({
    user: { id: 1, role, companies: [{ id: 1, role, name: "Volta" }] } as never,
    selectedCompanyId: 1,
    role: role as never,
    companyView: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  path.value = "/es/inicio";
  vi.mocked(getSubscription).mockResolvedValue(suspended);
});

describe("bloqueo por suscripción suspendida (spec 031)", () => {
  it("el dueño ve el motivo, el plan pendiente y Pagar ahora con la factura", async () => {
    as("owner");
    renderWithProviders(<SubscriptionGuard />);

    expect(await screen.findByText("Tu suscripción está suspendida")).toBeInTheDocument();
    expect(screen.getByText(/El cambio a este plan no se pagó/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pagar ahora/ })).toHaveAttribute("href", "https://invoice.stripe.com/i/guard");
  });

  it("sin URL de factura, Pagar ahora lleva a Suscripción", async () => {
    as("admin");
    vi.mocked(getSubscription).mockResolvedValue({ ...suspended, pay_url: null } as Subscription);
    renderWithProviders(<SubscriptionGuard />);

    expect(await screen.findByRole("link", { name: /Pagar ahora/ })).toHaveAttribute("href", "/es/suscripcion");
  });

  it("no tapa la pantalla de Suscripción: ahí se paga", async () => {
    as("owner");
    path.value = "/es/suscripcion";
    renderWithProviders(<SubscriptionGuard />);

    await vi.waitFor(() => expect(getSubscription).toHaveBeenCalled());
    expect(screen.queryByText("Tu suscripción está suspendida")).not.toBeInTheDocument();
  });

  it("el personal lee que la empresa está suspendida y que avise al dueño, sin botón de pago", async () => {
    as("staff");
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 403,
      data: { error: { details: { code: "subscription_suspended" } } },
    });
    renderWithProviders(<SubscriptionGuard />);

    expect(await screen.findByText("Tu suscripción está suspendida")).toBeInTheDocument();
    expect(screen.getByText(/Avisa al dueño de la cuenta/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pagar ahora/ })).not.toBeInTheDocument();
  });

  it("un 403 de suscripción vencida sigue con su mensaje de siempre", async () => {
    as("staff");
    vi.mocked(apiClient.get).mockResolvedValue({ status: 403, data: { error: { details: "expirada" } } });
    renderWithProviders(<SubscriptionGuard />);

    expect(await screen.findByText("Tu suscripción venció")).toBeInTheDocument();
  });

  it("el super admin nunca se bloquea", async () => {
    as("super_admin");
    renderWithProviders(<SubscriptionGuard />);

    expect(screen.queryByText("Tu suscripción está suspendida")).not.toBeInTheDocument();
  });
});
