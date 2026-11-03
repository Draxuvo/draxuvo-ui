import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Subscription } from "@/types";
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

describe("módulos adicionales en Suscripción (spec 053): solo lectura", () => {
  it("sin extras no pinta nada ni menciona «Módulos extra»", () => {
    const { container } = renderWithProviders(<AddonsSection subscription={sub()} cycle="monthly" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/Módulos extra/i)).toBeNull();
  });

  it("con el extra lo muestra activo con su precio y sin ningún botón de contratar o quitar", () => {
    renderWithProviders(<AddonsSection subscription={sub({ addons: [contracted()] as never })} cycle="monthly" />);

    expect(screen.getByRole("heading", { name: "Módulos adicionales" })).toBeInTheDocument();
    expect(screen.getByText("Punto de venta")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText(/\$199\.00 al mes/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/Módulos extra/i)).toBeNull();
  });

  it("con la baja programada dice hasta cuándo", () => {
    renderWithProviders(
      <AddonsSection subscription={sub({ addons: [contracted({ status: "ending", ends_at: "2026-12-15T12:00:00Z" })] as never })} cycle="monthly" />,
    );
    expect(screen.getByText(/Activo hasta el 15 dic 2026/)).toBeInTheDocument();
  });

  it("el ciclo anual muestra el precio al año", () => {
    renderWithProviders(<AddonsSection subscription={sub({ addons: [contracted({ amount_cents: 199_000 })] as never })} cycle="annual" />);
    expect(screen.getByText(/\$1,990\.00 al año/)).toBeInTheDocument();
  });
});

describe("desglose del cobro", () => {
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
