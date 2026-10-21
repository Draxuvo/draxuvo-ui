import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Ticket } from "@/types";

vi.mock("@/hooks/use-tickets", () => ({
  useTicket: () => ({ data: undefined }),
  useSendTicketWhatsapp: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/ticket-pdf", () => ({ downloadTicketPDF: vi.fn() }));
// Spec 030: el módulo Terminales está apagado; el historial del cobro no depende de él.
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleLocked: () => true,
  useModuleGate: () => ({ enabled: false, isLocked: () => true }),
}));
vi.mock("@/store/auth", () => ({
  useAuthStore: (selector: (s: { role: string }) => unknown) => selector({ role: "owner" }),
}));

import { TicketDetail } from "../ticket-detail";

const base: Ticket = {
  id: 70,
  folio: "T-0070",
  status: "paid",
  total: 500,
  created_at: "2026-10-19T19:00:00Z",
  paid_at: "2026-10-19T19:30:00Z",
  payment_method: "mixed",
  amount_received: 600,
  change_given: 100,
};

const checkTicket: Ticket = {
  ...base,
  work_order: null,
  work_order_id: null,
  check: { id: 31, table: "4", takeout_name: null, waiter: { id: 1, name: "Ana" } },
  payments: [
    { method: "cash", amount: "200.00", reference: null, amount_received: "300.00", change_given: "100.00" },
    { method: "card", amount: "300.00", reference: "A8812", amount_received: null, change_given: null },
  ],
  items: [{ description: "Tacos al pastor", quantity: 2, unit_price: 70, subtotal: 140 }],
};

beforeEach(() => vi.clearAllMocks());

describe("detalle de un ticket de cuenta", () => {
  it("muestra la mesa, el mesero y el método mixto", () => {
    renderWithProviders(<TicketDetail ticket={checkTicket} open onClose={() => {}} />);

    expect(screen.getByText("Mesa 4")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Mixto")).toBeInTheDocument();
  });

  it("lista cada pago con su método y su referencia", () => {
    renderWithProviders(<TicketDetail ticket={checkTicket} open onClose={() => {}} />);

    expect(screen.getByText("Efectivo")).toBeInTheDocument();
    expect(screen.getByText(/Tarjeta · Referencia: A8812/)).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument();
  });

  it("sigue mostrando la terminal de un cobro ya hecho aunque el módulo Terminales esté apagado (spec 030)", () => {
    const conTerminal: Ticket = {
      ...checkTicket,
      payments: [{ method: "card", amount: "300.00", reference: "A8812", terminal: { id: 3, name: "BBVA caja 1", provider: "bbva" }, amount_received: null, change_given: null }],
    };
    renderWithProviders(<TicketDetail ticket={conTerminal} open onClose={() => {}} />);

    expect(screen.getByText(/Tarjeta · BBVA caja 1/)).toBeInTheDocument();
  });

  it("lista lo vendido aunque los renglones no tengan id", () => {
    renderWithProviders(<TicketDetail ticket={checkTicket} open onClose={() => {}} />);

    expect(screen.getByText("Tacos al pastor")).toBeInTheDocument();
  });

  it("no ofrece ver la orden porque la cuenta no tiene orden de trabajo", () => {
    renderWithProviders(<TicketDetail ticket={checkTicket} open onClose={() => {}} />);

    expect(screen.queryByRole("link", { name: /Ver orden/ })).not.toBeInTheDocument();
  });

  it("una cuenta para llevar muestra el nombre del cliente", () => {
    const takeout = { ...checkTicket, check: { id: 32, table: null, takeout_name: "Luis", waiter: null } };
    renderWithProviders(<TicketDetail ticket={takeout} open onClose={() => {}} />);

    expect(screen.getByText("Para llevar: Luis")).toBeInTheDocument();
  });

  it("un ticket de orden de trabajo conserva su enlace a la orden", () => {
    const order: Ticket = { ...base, payment_method: "cash", work_order_id: 5, work_order: { id: 5, title: "Cambiar balatas" } };
    renderWithProviders(<TicketDetail ticket={order} open onClose={() => {}} />);

    expect(screen.getByText("Cambiar balatas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver/ })).toBeInTheDocument();
  });
});
