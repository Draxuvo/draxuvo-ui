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

vi.mock("@/hooks/use-work-orders", () => ({
  useChargeOrder: () => ({ mutate: chargeMutate, isPending: false }),
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
      { payment_method: "cash", amount_received: 1000 },
      expect.any(Object),
    );
  });

  it("el monto exacto deja confirmar con cambio en cero", async () => {
    abre(pendiente);
    await userEvent.type(screen.getByLabelText("Recibido"), "850");
    expect(screen.getByText("Cambio: $0.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeEnabled();
  });

  it.each([
    ["Tarjeta", "card"],
    ["Transferencia", "transfer"],
  ])("con %s no pide monto y se puede confirmar", async (nombre, clave) => {
    abre(pendiente);
    await userEvent.click(screen.getByRole("radio", { name: nombre }));
    expect(screen.queryByLabelText("Recibido")).toBeNull();
    const confirmar = screen.getByRole("button", { name: "Confirmar cobro" });
    expect(confirmar).toBeEnabled();
    await userEvent.click(confirmar);
    expect(chargeMutate).toHaveBeenCalledWith({ payment_method: clave }, expect.any(Object));
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
