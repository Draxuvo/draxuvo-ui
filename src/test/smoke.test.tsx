import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/work-orders/status-badge";
import { renderWithProviders } from "./render";

describe("corredor de pruebas", () => {
  it("pinta un componente con mensajes reales en español", () => {
    renderWithProviders(<StatusBadge status="paid" />);
    expect(screen.getByText("Cobrada")).toBeInTheDocument();
  });
});
