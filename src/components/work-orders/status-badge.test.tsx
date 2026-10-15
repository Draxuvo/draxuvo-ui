import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { StatusBadge } from "./status-badge";

const CASOS = [
  ["open", "Abierta"],
  ["in_progress", "En curso"],
  ["done", "Terminada"],
  ["paid", "Cobrada"],
  ["cancelled", "Cancelada"],
] as const;

describe("StatusBadge", () => {
  it.each(CASOS)("el estado %s muestra el texto %s y un ícono", (status, texto) => {
    renderWithProviders(<StatusBadge status={status} />);
    const badge = screen.getByText(texto);
    expect(badge).toBeInTheDocument();
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("un estado desconocido muestra el texto crudo con ícono genérico", () => {
    renderWithProviders(<StatusBadge status="raro" />);
    const badge = screen.getByText("raro");
    expect(badge.querySelector("svg")).not.toBeNull();
  });
});
