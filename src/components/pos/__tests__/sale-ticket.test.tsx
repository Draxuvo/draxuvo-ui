import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Sale } from "@/types";

vi.mock("@/services/sales", () => ({ salesService: { ticketPdf: vi.fn(), sendTicketWhatsapp: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { salesService } from "@/services/sales";
import { SaleTicket } from "../sale-ticket";

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 7, status: "paid", status_label: "Cobrada", total: "85.00", items_count: 1, opened_by: null, charged_by: null, paid_at: null,
  cancelled_at: null, cancelled_by: null, cancel_reason: null, lock_version: 3, created_at: "2026-11-03T10:00:00Z", folio: "T-000009",
  actions: ["ticket"], items: [], ticket: { id: 9, folio: "T-000009" } as never, whatsapp_available: false, ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(salesService.ticketPdf).mockResolvedValue(new Blob(["%PDF"]));
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

describe("ticket de la venta (spec 050)", () => {
  it("empieza en 80 mm, recuerda el tamaño elegido y lo usa al descargar", async () => {
    renderWithProviders(<SaleTicket sale={sale()} />);
    const select = screen.getByLabelText("Tamaño del ticket");
    expect(select).toHaveValue("thermal80");

    await userEvent.setup().selectOptions(select, "thermal58");
    expect(localStorage.getItem("draxuvo.pos.paper")).toBe("thermal58");

    await userEvent.setup().click(screen.getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(salesService.ticketPdf).toHaveBeenCalledWith(7, "thermal58"));
  });

  it("recupera el tamaño guardado", () => {
    localStorage.setItem("draxuvo.pos.paper", "a4");
    renderWithProviders(<SaleTicket sale={sale()} />);
    expect(screen.getByLabelText("Tamaño del ticket")).toHaveValue("a4");
  });

  it("ofrece los tres tamaños", () => {
    renderWithProviders(<SaleTicket sale={sale()} />);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Carta", "Térmico 58 mm", "Térmico 80 mm"]);
  });

  it("sin el módulo de WhatsApp no ofrece mandarlo", () => {
    renderWithProviders(<SaleTicket sale={sale({ whatsapp_available: false })} />);
    expect(screen.queryByLabelText("Teléfono del cliente")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar por WhatsApp" })).not.toBeInTheDocument();
  });

  it("con el módulo pide el teléfono y manda el ticket", async () => {
    vi.mocked(salesService.sendTicketWhatsapp).mockResolvedValue({ message: "ok" });
    renderWithProviders(<SaleTicket sale={sale({ whatsapp_available: true })} />);
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "Enviar por WhatsApp" })).toBeDisabled();
    await user.type(screen.getByLabelText("Teléfono del cliente"), "5512345678");
    await user.click(screen.getByRole("button", { name: "Enviar por WhatsApp" }));

    await waitFor(() => expect(salesService.sendTicketWhatsapp).toHaveBeenCalledWith(7, "5512345678"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ticket enviado por WhatsApp"));
  });

  it("si WhatsApp falla avisa", async () => {
    vi.mocked(salesService.sendTicketWhatsapp).mockRejectedValue(new Error("boom"));
    renderWithProviders(<SaleTicket sale={sale({ whatsapp_available: true })} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Teléfono del cliente"), "5512345678");
    await user.click(screen.getByRole("button", { name: "Enviar por WhatsApp" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo mandar el ticket por WhatsApp"));
  });

  it("una venta cancelada se muestra marcada con su motivo", () => {
    renderWithProviders(<SaleTicket sale={sale({ status: "cancelled", cancel_reason: "Cliente devolvió" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Venta cancelada · Motivo: Cliente devolvió");
  });

  it("sin ticket no pinta nada", () => {
    const { container } = renderWithProviders(<SaleTicket sale={sale({ ticket: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("si el PDF falla avisa", async () => {
    vi.mocked(salesService.ticketPdf).mockRejectedValue(new Error("boom"));
    renderWithProviders(<SaleTicket sale={sale()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo generar el PDF del ticket"));
  });
});
