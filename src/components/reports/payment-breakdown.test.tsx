import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { IncomeReport } from "@/types";
import { PaymentBreakdown } from "./payment-breakdown";

const EMPTY: IncomeReport = {
  period: { from: "2026-10-01", to: "2026-10-21" },
  total_revenue: 0,
  total_tickets: 0,
  by_period: [],
  breakdown: [],
};

describe("PaymentBreakdown (spec 015)", () => {
  it("pinta lo cobrado por método y por terminal, con el renglón sin terminal", () => {
    const report: IncomeReport = {
      period: { from: "2026-10-01", to: "2026-10-21" },
      total_revenue: 580,
      total_tickets: 3,
      by_period: [],
      breakdown: [],
      by_method: [
        { method: "card", label: "Tarjeta", total: 380, count: 2 },
        { method: "cash", label: "Efectivo", total: 200, count: 1 },
      ],
      by_terminal: [
        { terminal: { id: 3, name: "BBVA caja 1", provider: "bbva" }, total: 300, count: 1 },
        { terminal: null, total: 80, count: 1 },
      ],
    };
    renderWithProviders(<PaymentBreakdown report={report} />);

    expect(screen.getByText("Por método")).toBeInTheDocument();
    expect(screen.getByText("$380.00")).toBeInTheDocument();
    expect(screen.getByText("BBVA caja 1")).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument();
    expect(screen.getByText("Sin terminal")).toBeInTheDocument();
    expect(screen.getByText("2 pagos")).toBeInTheDocument();
  });

  it("sin pagos en el rango no pinta nada", () => {
    const { container } = renderWithProviders(<PaymentBreakdown report={{ ...EMPTY, by_method: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
