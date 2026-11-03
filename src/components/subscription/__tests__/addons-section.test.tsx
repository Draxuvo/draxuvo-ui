import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Subscription } from "@/types";

vi.mock("@/services/subscription", () => ({ addAddon: vi.fn(), removeAddon: vi.fn(), reactivateAddon: vi.fn() }));
const catalog = vi.hoisted(() => ({
  iva_rate: 0.16,
  plans: [],
  modules: [],
  addons: [
    {
      key: "pos",
      requires: ["inventory"],
      prices: {
        monthly: { amount_cents: 19_900, iva_cents: 3_184, total_cents: 23_084 },
        annual: { amount_cents: 199_000, iva_cents: 31_840, total_cents: 230_840 },
      },
    },
  ],
}));
vi.mock("@/services/plans", () => ({ getPlans: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { addAddon, reactivateAddon, removeAddon } from "@/services/subscription";
import { getPlans } from "@/services/plans";
import { AddonsSection, BillingBreakdown } from "../addons-section";

const base = {
  plan: "basic",
  billing_cycle: "monthly",
  status: "active",
  amount_cents: 39_900,
  addons: [],
  addons_cents: 0,
  iva_cents: 6_384,
  total_cents: 46_284,
  current_period_end: "2026-12-01T00:00:00Z",
  active_modules: ["employees", "inventory"],
  available_modules: ["employees", "inventory"],
} as unknown as Subscription;

const sub = (over: Partial<Subscription> = {}): Subscription => ({ ...base, ...over }) as Subscription;
const contracted = (over = {}) => ({ module: "pos", amount_cents: 19_900, started_at: "2026-11-01T00:00:00Z", ends_at: null, status: "active", ...over });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getPlans).mockResolvedValue(catalog as never);
  useAuthStore.setState({ selectedCompanyId: 1, role: "owner", user: { id: 1, role: "owner", companies: [] } as never });
});

describe("módulos extra en Suscripción (spec 050)", () => {
  it("muestra el módulo con su precio sin IVA y lo ofrece para contratar", async () => {
    renderWithProviders(<AddonsSection subscription={sub()} mode="manage" cycle="monthly" />);

    const item = await screen.findByRole("listitem");
    expect(within(item).getByText("Punto de venta")).toBeInTheDocument();
    expect(within(item).getByText(/\$199\.00 al mes · sin IVA/)).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Contratar" })).toBeEnabled();
    expect(within(item).getByText(/cobra de inmediato la parte proporcional/)).toBeInTheDocument();
  });

  it("el precio anual sale a 10 meses", async () => {
    renderWithProviders(<AddonsSection subscription={sub({ billing_cycle: "annual" })} mode="manage" cycle="annual" />);
    expect(await screen.findByText(/\$1,990\.00 al año/)).toBeInTheDocument();
  });

  it("contratar llama a la API y avisa", async () => {
    vi.mocked(addAddon).mockResolvedValue(sub({ addons: [contracted()] as never, addons_cents: 19_900 }));
    renderWithProviders(<AddonsSection subscription={sub()} mode="manage" cycle="monthly" />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Contratar" }));

    await waitFor(() => expect(addAddon).toHaveBeenCalledWith("pos"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Punto de venta contratado"));
  });

  it("si el cobro falla lo dice y no marca nada como contratado", async () => {
    vi.mocked(addAddon).mockRejectedValue({ response: { data: { error: { details: { code: "addon_payment_failed" } } } } });
    renderWithProviders(<AddonsSection subscription={sub()} mode="manage" cycle="monthly" />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Contratar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo cobrar. Revisa tu método de pago."));
    expect(screen.queryByText("Contratado")).not.toBeInTheDocument();
  });

  it("sin Inventario no se puede contratar y se dice qué falta", async () => {
    renderWithProviders(<AddonsSection subscription={sub({ available_modules: ["employees"] })} mode="manage" cycle="monthly" />);

    expect(await screen.findByRole("button", { name: "Contratar" })).toBeDisabled();
    expect(screen.getByText("Necesita Inventario")).toBeInTheDocument();
  });

  it("un módulo contratado se ve como tal y se da de baja con confirmación y sin reembolso", async () => {
    vi.mocked(removeAddon).mockResolvedValue(sub({ addons: [contracted({ status: "ending", ends_at: "2026-12-01T00:00:00Z" })] as never }));
    renderWithProviders(<AddonsSection subscription={sub({ addons: [contracted()] as never })} mode="manage" cycle="monthly" />);
    const user = userEvent.setup();

    expect(await screen.findByText("Contratado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dar de baja" }));
    expect(removeAddon).not.toHaveBeenCalled();
    expect(await screen.findByText(/No se hace reembolso/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dar de baja", hidden: false }));

    await waitFor(() => expect(removeAddon).toHaveBeenCalledWith("pos"));
  });

  it("con la baja programada muestra la fecha y permite reactivar", async () => {
    vi.mocked(reactivateAddon).mockResolvedValue(sub({ addons: [contracted()] as never }));
    renderWithProviders(
      <AddonsSection subscription={sub({ addons: [contracted({ status: "ending", ends_at: "2026-12-01T00:00:00Z" })] as never })} mode="manage" cycle="monthly" />,
    );

    expect(await screen.findByText(/Termina el 1 dic 2026|Termina el 30 nov 2026/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => expect(reactivateAddon).toHaveBeenCalledWith("pos"));
  });

  it("en modo pago se elige con una casilla para sumarlo al pago del plan", async () => {
    const onToggle = vi.fn();
    renderWithProviders(<AddonsSection subscription={sub({ status: "trialing" })} mode="pay" cycle="monthly" selected={["pos"]} onToggle={onToggle} />);

    const box = await screen.findByRole("checkbox", { name: "Incluir Punto de venta al pagar" });
    expect(box).toBeChecked();
    expect(screen.getByText("Se cobrará junto con tu plan.")).toBeInTheDocument();
    await userEvent.setup().click(box);
    expect(onToggle).toHaveBeenCalledWith("pos");
    expect(screen.queryByRole("button", { name: "Contratar" })).not.toBeInTheDocument();
  });

  it("en una demo la sección es informativa: muestra el módulo contratado sin acciones ni aviso de permisos", async () => {
    renderWithProviders(<AddonsSection subscription={sub({ addons: [contracted()] as never })} mode="readonly" cycle="monthly" readOnlyNote={false} />);

    expect(await screen.findByText("Contratado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Solo el dueño y el administrador/)).not.toBeInTheDocument();
  });

  it("solo lectura no ofrece acciones", async () => {
    renderWithProviders(<AddonsSection subscription={sub()} mode="readonly" cycle="monthly" />);
    await screen.findByText("Punto de venta");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Solo el dueño y el administrador/)).toBeInTheDocument();
  });
});

describe("desglose del cobro (spec 050)", () => {
  it("suma el plan, cada extra, el subtotal, el IVA y el total", () => {
    renderWithProviders(
      <BillingBreakdown
        planName="Básico"
        subscription={sub({ addons: [contracted()] as never, addons_cents: 19_900, iva_cents: 9_568, total_cents: 69_368 })}
      />,
    );
    const list = within(screen.getByLabelText("Desglose del cobro"));
    expect(list.getByText("Plan Básico").nextSibling).toHaveTextContent("$399.00");
    expect(list.getByText("Punto de venta").nextSibling).toHaveTextContent("$199.00");
    expect(list.getByText("Subtotal").nextSibling).toHaveTextContent("$598.00");
    expect(list.getByText("IVA").nextSibling).toHaveTextContent("$95.68");
    expect(list.getByText("Total").nextSibling).toHaveTextContent("$693.68");
  });

  it("sin extras no pinta nada", () => {
    const { container } = renderWithProviders(<BillingBreakdown planName="Básico" subscription={sub()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
