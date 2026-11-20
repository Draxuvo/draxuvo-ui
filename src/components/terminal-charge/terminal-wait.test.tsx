import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { TerminalCharge } from "@/types";
import { TerminalWait } from "./terminal-wait";

const base: TerminalCharge = {
  id: 1, status: "pending", status_detail: "at_terminal", amount: "350.00",
  terminal: { id: 7, name: "Caja 1", provider: "mercado_pago" }, owner: { type: "sale", id: 3, label: "#3" },
  created_by: null, created_at: "", expires_at: "", resolved_at: null, provider_reference: null, card_last4: null,
  unapplied_reason: null, result: null, refund: null, allowed_actions: ["cancel", "abandon"],
};

function render(charge: TerminalCharge | null, extra: Partial<Parameters<typeof TerminalWait>[0]> = {}) {
  const handlers = { onCancel: vi.fn(), onRetry: vi.fn(), onChooseOther: vi.fn(), onManual: vi.fn() };
  renderWithProviders(
    <TerminalWait amount="$350.00" terminalName="Caja 1" charge={charge} starting={false} error={null} canceling={false} {...handlers} {...extra} />,
  );
  return handlers;
}

describe("TerminalWait (spec 069)", () => {
  it("mientras espera muestra el monto, la terminal y deja cancelar", async () => {
    const h = render(base);
    expect(screen.getByText("$350.00")).toBeInTheDocument();
    expect(screen.getByText("Caja 1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Esperando terminal…");
    expect(screen.getByRole("status")).toHaveTextContent("Esperando el pago en la terminal");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(h.onCancel).toHaveBeenCalled();
  });

  it("registrar a mano durante la espera pide confirmar y advierte revisar la terminal", async () => {
    const h = render(base);
    await userEvent.click(screen.getByRole("button", { name: "Registrar a mano" }));
    expect(screen.getByText(/revisa en la terminal que el cliente no haya pagado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sí, registrar a mano" }));
    expect(h.onManual).toHaveBeenCalled();
  });

  it("rechazada explica el motivo y ofrece reintentar, otra terminal o a mano", async () => {
    const h = render({ ...base, status: "declined", status_detail: "rejected_by_issuer" });
    expect(screen.getByRole("alert")).toHaveTextContent("El banco rechazó la tarjeta");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(h.onRetry).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Elegir otra terminal o forma de pago" }));
    expect(h.onChooseOther).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Registrar a mano" }));
    expect(h.onManual).toHaveBeenCalled();
  });

  it("un error al mandar usa el texto del cobro si lo conoce", () => {
    render(null, { error: { code: "terminal_busy" } });
    expect(screen.getByRole("alert")).toHaveTextContent("La terminal está ocupada con otro cobro");
  });

  it("sin aplicar avisa que lo revisa un jefe", () => {
    render({ ...base, status: "unapplied" });
    expect(screen.getByRole("alert")).toHaveTextContent("Pagos sin aplicar");
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
});
