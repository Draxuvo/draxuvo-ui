import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { WorkOrder } from "@/types";
import { ChargeDialog } from "./charge-dialog";

const chargeMutate = vi.hoisted(() => vi.fn());
const sendWhatsapp = vi.hoisted(() => vi.fn());
const downloadTicketPDF = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

const terminals = vi.hoisted(() => ({ list: [] as Array<{ id: number; name: string; provider: string; provider_label: string; active: boolean }> }));

vi.mock("@/hooks/use-work-orders", () => ({
  useChargeOrder: () => ({ mutate: chargeMutate, isPending: false }),
}));
vi.mock("@/hooks/use-payment-terminals", () => ({
  usePaymentTerminals: () => ({ data: terminals.list }),
}));
vi.mock("@/services/tickets", () => ({ ticketsService: { sendWhatsapp } }));
vi.mock("@/lib/ticket-pdf", () => ({ downloadTicketPDF }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));

const pendiente = { id: 5, total: 850, status: "done", customer_phone: "5219876543210" } as WorkOrder;
const cobrada = { ...pendiente, status: "paid", ticket: { id: 77, folio: "T-0042" } } as WorkOrder;

function abre(order: WorkOrder) {
  return renderWithProviders(<ChargeDialog order={order} open onOpenChange={() => {}} />);
}

beforeEach(() => {
  terminals.list = [];
  chargeMutate.mockReset();
  sendWhatsapp.mockReset();
  downloadTicketPDF.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("ChargeDialog", () => {
  it("muestra el total y deja el cobro en efectivo sin confirmar hasta capturar el monto", () => {
    abre(pendiente);
    expect(screen.getByText("$850.00")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Efectivo" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  });

  it("si lo recibido no alcanza muestra lo que falta y no deja confirmar", async () => {
    abre(pendiente);
    await userEvent.type(screen.getByLabelText("Recibido"), "500");
    expect(screen.getByText("Falta $350.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  });

  it("si lo recibido sobra muestra el cambio y deja confirmar", async () => {
    abre(pendiente);
    await userEvent.type(screen.getByLabelText("Recibido"), "1000");
    expect(screen.getByText("Cambio: $150.00")).toBeInTheDocument();
    const confirmar = screen.getByRole("button", { name: "Confirmar cobro" });
    expect(confirmar).toBeEnabled();
    await userEvent.click(confirmar);
    expect(chargeMutate).toHaveBeenCalledWith(
      { payments: [{ method: "cash", amount_received: 1000 }], idempotencyKey: expect.any(String) },
      expect.any(Object),
    );
  });

  it("el monto exacto deja confirmar con cambio en cero", async () => {
    abre(pendiente);
    await userEvent.type(screen.getByLabelText("Recibido"), "850");
    expect(screen.getByText("Cambio: $0.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeEnabled();
  });

  it("con tarjeta no pide monto, la autorización es opcional y cobra el total", async () => {
    abre(pendiente);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.queryByLabelText("Recibido")).toBeNull();
    const confirmar = screen.getByRole("button", { name: "Confirmar cobro" });
    expect(confirmar).toBeEnabled();
    await userEvent.click(confirmar);
    expect(chargeMutate).toHaveBeenCalledWith(
      { payments: [{ method: "card", amount: 850 }], idempotencyKey: expect.any(String) },
      expect.any(Object),
    );
  });

  it("con transferencia pide la referencia", async () => {
    abre(pendiente);
    await userEvent.click(screen.getByRole("radio", { name: "Transferencia" }));
    const confirmar = screen.getByRole("button", { name: "Confirmar cobro" });
    expect(confirmar).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Referencia"), "SPEI 9");
    await userEvent.click(confirmar);
    expect(chargeMutate.mock.calls[0][0].payments).toEqual([{ method: "transfer", amount: 850, reference: "SPEI 9" }]);
  });

  // --- spec 015: varios pagos y terminal ---

  it("tarjeta 300 + efectivo 250 sobre 500 da cambio de 50 y manda los dos pagos", async () => {
    terminals.list = [{ id: 3, name: "BBVA caja 1", provider: "bbva", provider_label: "BBVA", active: true }];
    abre({ ...pendiente, total: 500 } as WorkOrder);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.getByLabelText("Terminal")).toHaveValue("3");
    await userEvent.type(screen.getByLabelText("Autorización"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Agregar otro pago" }));

    const montos = screen.getAllByLabelText("Monto");
    await userEvent.clear(montos[0]);
    await userEvent.type(montos[0], "300");
    await userEvent.type(screen.getByLabelText("Recibido"), "250");
    expect(screen.getByText("Cambio: $50.00")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));
    expect(chargeMutate.mock.calls[0][0].payments).toEqual([
      { method: "card", amount: 300, terminal_id: 3, authorization_code: "123456" },
      { method: "cash", amount_received: 250 },
    ]);
  });

  // --- spec 030: sin el módulo Terminales (lista vacía) el cobro con tarjeta sale sin terminal ---

  it("sin terminales no hay selector y el pago con tarjeta se manda sin terminal_id", async () => {
    abre({ ...pendiente, total: 500 } as WorkOrder);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.queryByLabelText("Terminal")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));
    expect(chargeMutate.mock.calls[0][0].payments).toEqual([{ method: "card", amount: 500 }]);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("sin sobrar nada que mostrar: sin cubrir el total no deja cobrar y muestra lo que falta", async () => {
    abre({ ...pendiente, total: 500 } as WorkOrder);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar otro pago" }));
    const montos = screen.getAllByLabelText("Monto");
    await userEvent.clear(montos[0]);
    await userEvent.type(montos[0], "300");
    await userEvent.type(screen.getByLabelText("Recibido"), "100");
    expect(screen.getByText("Falta $100.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  });

  it("con varias terminales exige elegir una", async () => {
    terminals.list = [
      { id: 3, name: "BBVA caja 1", provider: "bbva", provider_label: "BBVA", active: true },
      { id: 4, name: "Point barra", provider: "mercado_pago", provider_label: "Mercado Pago", active: true },
    ];
    abre(pendiente);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Terminal"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));
    expect(chargeMutate.mock.calls[0][0].payments).toEqual([{ method: "card", amount: 850, terminal_id: 4 }]);
  });

  it("muestra el mensaje del código de error de la API", async () => {
    chargeMutate.mockImplementation((_vars, opts) =>
      opts.onError({ response: { data: { error: { details: { code: "exceeds_total" } } } } }),
    );
    abre(pendiente);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));
    expect(toastError).toHaveBeenCalledWith("Los pagos con tarjeta o transferencia pasan del total");
  });

  it("si la API dice no_items avisa que la orden no tiene conceptos con precio", async () => {
    chargeMutate.mockImplementation((_vars, opts) =>
      opts.onError({ response: { data: { error: { details: { reason: "no_items" } } } } }),
    );
    abre(pendiente);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));
    expect(toastError).toHaveBeenCalledWith("La orden no tiene conceptos con precio");
  });

  it("cualquier otro error muestra el aviso general", async () => {
    chargeMutate.mockImplementation((_vars, opts) => opts.onError(new Error("boom")));
    abre(pendiente);
    await userEvent.click(screen.getByRole("radio", { name: "Tarjeta" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));
    expect(toastError).toHaveBeenCalledWith("No se pudo registrar el cobro");
  });

  it("ya cobrada muestra el folio, el PDF y WhatsApp con el teléfono prellenado", async () => {
    abre(cobrada);
    expect(screen.getByText("Cobrado con folio T-0042")).toBeInTheDocument();
    expect(screen.getByLabelText("Teléfono")).toHaveValue("5219876543210");

    await userEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));
    expect(downloadTicketPDF).toHaveBeenCalledWith(77, "T-0042");

    sendWhatsapp.mockResolvedValue({});
    await userEvent.click(screen.getByRole("button", { name: "Enviar por WhatsApp" }));
    expect(sendWhatsapp).toHaveBeenCalledWith(77, "5219876543210");
    expect(await screen.findByText("Listo")).toBeInTheDocument();
  });

  it("si WhatsApp falla avisa del error", async () => {
    sendWhatsapp.mockRejectedValue(new Error("x"));
    abre(cobrada);
    await userEvent.click(screen.getByRole("button", { name: "Enviar por WhatsApp" }));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudo enviar por WhatsApp"));
  });
});
