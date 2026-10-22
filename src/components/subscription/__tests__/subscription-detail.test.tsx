import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Subscription } from "@/types";

vi.mock("@/services/subscription", () => ({
  getSubscription: vi.fn(),
  createCheckout: vi.fn(),
  createPortal: vi.fn(),
}));
vi.mock("@/services/plans", () => ({
  getPlans: vi.fn().mockResolvedValue({
    plans: ["basic", "pro", "enterprise"].map((key) => ({
      key,
      modules: ["employees"],
      prices: { monthly: { total_cents: 100_000 }, annual: { total_cents: 1_000_000 } },
    })),
  }),
}));
vi.mock("@/components/layout/company-switcher", () => ({ useSwitchCompany: () => vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { getSubscription } from "@/services/subscription";
import { SubscriptionDetail } from "../subscription-detail";

const base = {
  plan: "pro",
  billing_cycle: "monthly",
  cancel_at_period_end: false,
  amount_cents: 70_000,
  iva_cents: 11_200,
  total_cents: 81_200,
  active_modules: [],
  available_modules: [],
  active_access: true,
} as unknown as Subscription;

const show = (sub: Partial<Subscription>) =>
  vi.mocked(getSubscription).mockResolvedValue({ ...base, ...sub } as Subscription);

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ selectedCompanyId: 1, role: "owner", user: { id: 1, role: "owner", companies: [] } as never });
});

describe("Suscripción en prueba (spec 031)", () => {
  it("el plan asignado queda fijo: se explica quién lo cambia y los otros planes no se pueden elegir", async () => {
    show({ status: "trialing", plan: "pro", trial_days_remaining: 12, trial_ends_at: "2026-11-02T00:00:00Z", amount_cents: 0, total_cents: 0 });
    renderWithProviders(<SubscriptionDetail />);

    expect(await screen.findByText(/solo lo cambia el equipo de Draxuvo/)).toBeInTheDocument();
    const cards = await screen.findAllByRole("button", { pressed: true });
    expect(cards.length).toBeGreaterThan(0);
    const [basic, pro, enterprise] = ["Básico", "Pro", "Empresa"].map((name) =>
      screen.getAllByRole("button").find((b) => b.textContent?.includes(name) && b.hasAttribute("aria-pressed")),
    );
    expect(pro).toBeEnabled();
    expect(basic).toBeDisabled();
    expect(enterprise).toBeDisabled();
  });
});

describe("Suscripción suspendida (spec 031)", () => {
  it("muestra el motivo, el plan pendiente, la fecha de cancelación y Pagar ahora con la URL de la factura", async () => {
    show({
      status: "suspended",
      active_access: false,
      suspension_reason: "plan_change",
      cancels_at: "2026-11-21T10:00:00Z",
      pay_url: "https://invoice.stripe.com/i/test",
    });
    renderWithProviders(<SubscriptionDetail />);

    expect(await screen.findByText("El cambio a este plan no se pagó.")).toBeInTheDocument();
    expect(screen.getByText(/Plan pendiente de pago/)).toBeInTheDocument();
    expect(screen.getByText(/la suscripción se cancela el/)).toBeInTheDocument();
    const pay = screen.getByRole("link", { name: /Pagar ahora/ });
    expect(pay).toHaveAttribute("href", "https://invoice.stripe.com/i/test");
  });

  it("un cobro normal vencido explica el otro motivo y ofrece administrar el pago en el portal", async () => {
    show({ status: "suspended", active_access: false, suspension_reason: "payment_overdue", cancels_at: "2026-11-21T10:00:00Z" });
    renderWithProviders(<SubscriptionDetail />);

    expect(await screen.findByText("Un cobro lleva más de 7 días sin pagarse.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pagar ahora/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Administrar suscripción" })).toBeInTheDocument();
  });

  it("con pago pendiente muestra hasta cuándo se puede pagar sin perder el acceso", async () => {
    show({ status: "past_due", grace_ends_at: "2026-10-29T10:00:00Z" });
    renderWithProviders(<SubscriptionDetail />);

    expect(await screen.findByText(/Tienes hasta el .* para pagar sin perder el acceso/)).toBeInTheDocument();
  });
});
