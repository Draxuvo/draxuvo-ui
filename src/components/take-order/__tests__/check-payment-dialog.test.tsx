import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Check } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-payment-terminals", () => ({ usePaymentTerminals: () => ({ data: [] }) }));
vi.mock("@/lib/ticket-pdf", () => ({ downloadTicketPDF: vi.fn() }));
vi.mock("@/services/restaurant", () => ({ restaurantService: { addPayment: vi.fn(), getCheck: vi.fn() } }));

import { restaurantService } from "@/services/restaurant";
import { CheckPaymentDialog } from "../check-payment-dialog";

const check: Check = {
  id: 10, status: "open", table: { id: 1, name: "4" }, takeout_name: null, waiter: null, opened_at: "",
  total: "100.00", paid: "0.00", balance: "100.00", items: [], payments: [], ticket_id: null, allowed_actions: ["pay"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(restaurantService.getCheck).mockResolvedValue(check);
});

describe("CheckPaymentDialog", () => {
  it("cobra en efectivo con cambio y ofrece el ticket al cubrir la cuenta", async () => {
    vi.mocked(restaurantService.addPayment).mockResolvedValue({
      payment: { method: "cash", amount: "100.00", reference: null, amount_received: "200.00", change_given: "100.00" },
      check: { status: "closed", total: "100.00", paid: "100.00", balance: "0.00" },
      ticket: { id: 5, folio: "T-0005" } as never,
    });
    renderWithProviders(<CheckPaymentDialog check={check} open onOpenChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Recibido"), "200");
    expect(screen.getByRole("status")).toHaveTextContent("Cambio");
    await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() =>
      expect(restaurantService.addPayment).toHaveBeenCalledWith(
        10, { method: "cash", amount: "100.00", amount_received: "200.00" }, expect.any(String),
      ),
    );
    expect(await screen.findByText("Ticket T-0005")).toBeInTheDocument();
  });

  it("pide la referencia con tarjeta y no deja pasar del saldo", async () => {
    renderWithProviders(<CheckPaymentDialog check={check} open onOpenChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));

    await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe la referencia");

    await userEvent.type(screen.getByLabelText("Referencia"), "AB123");
    await userEvent.clear(screen.getByLabelText("Monto"));
    await userEvent.type(screen.getByLabelText("Monto"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    expect(screen.getByRole("alert")).toHaveTextContent("no puede pasar del saldo");
    expect(restaurantService.addPayment).not.toHaveBeenCalled();
  });

  it("sugiere el saldo vigente aunque la cuenta cambie con el diálogo ya montado", () => {
    const { rerender } = renderWithProviders(
      <CheckPaymentDialog check={{ ...check, total: "0.00", balance: "0.00" }} open onOpenChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Monto")).toHaveValue("0.00");
    rerender(<CheckPaymentDialog check={check} open onOpenChange={vi.fn()} />);
    expect(screen.getByLabelText("Monto")).toHaveValue("100.00");
  });
});
