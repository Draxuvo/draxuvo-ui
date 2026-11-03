import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Sale, SaleItem } from "@/types";
import { SaleCart } from "../sale-cart";

const item = (over: Partial<SaleItem> = {}): SaleItem => ({
  id: 1, product_id: 10, name: "Cuaderno profesional", sku: "PAP-001", unit_price: "42.50", quantity: 2, subtotal: "85.00",
  icon: null, stock: 18, fractional: false, ...over,
});

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 7, status: "open", status_label: "Abierta", total: "85.00", items_count: 1, opened_by: null, charged_by: null, paid_at: null,
  cancelled_at: null, cancelled_by: null, cancel_reason: null, lock_version: 3, created_at: "2026-11-03T10:00:00Z", folio: null,
  actions: ["add_item", "charge", "discard"], items: [item()], ticket: null, ...over,
});

function setup(props: Partial<Parameters<typeof SaleCart>[0]> = {}) {
  const handlers = { onQuantity: vi.fn(), onRemove: vi.fn(), onCharge: vi.fn(), onDiscard: vi.fn() };
  renderWithProviders(<SaleCart sale={sale()} busy={false} {...handlers} {...props} />);
  return handlers;
}

describe("venta en curso (spec 050)", () => {
  it("muestra los renglones, el total y el botón de cobrar con el monto", () => {
    setup();
    expect(screen.getByText("Cuaderno profesional")).toBeInTheDocument();
    expect(screen.getAllByText("$85.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Cobrar $85.00" })).toBeEnabled();
  });

  it("sumar, restar y quitar avisan con el renglón y la cantidad nueva", async () => {
    const h = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sumar uno a Cuaderno profesional" }));
    expect(h.onQuantity).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 3);
    await user.click(screen.getByRole("button", { name: "Quitar uno a Cuaderno profesional" }));
    expect(h.onQuantity).toHaveBeenLastCalledWith(expect.objectContaining({ id: 1 }), 1);
    await user.click(screen.getByRole("button", { name: "Quitar Cuaderno profesional" }));
    expect(h.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("restar la última pieza manda cantidad cero", async () => {
    const h = setup({ sale: sale({ items: [item({ quantity: 1 })] }) });
    await userEvent.setup().click(screen.getByRole("button", { name: "Quitar uno a Cuaderno profesional" }));
    expect(h.onQuantity).toHaveBeenCalledWith(expect.anything(), 0);
  });

  it("los productos fraccionarios cambian de medio en medio", async () => {
    const h = setup({ sale: sale({ items: [item({ fractional: true, quantity: 1.5 })] }) });
    await userEvent.setup().click(screen.getByRole("button", { name: "Sumar uno a Cuaderno profesional" }));
    expect(h.onQuantity).toHaveBeenCalledWith(expect.anything(), 2);
  });

  it("sin renglones guía al cajero y no deja cobrar", () => {
    setup({ sale: sale({ items: [], total: "0.00" }) });
    expect(screen.getByText("Escanea un producto o búscalo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cobrar/ })).toBeDisabled();
  });

  it("sin venta abierta el botón de cobrar está apagado", () => {
    setup({ sale: null });
    expect(screen.getByRole("button", { name: /Cobrar/ })).toBeDisabled();
  });

  it("ocupado bloquea los cambios", () => {
    setup({ busy: true });
    expect(screen.getByRole("button", { name: "Sumar uno a Cuaderno profesional" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cobrar/ })).toBeDisabled();
  });

  it("descartar y cobrar llaman a sus acciones", async () => {
    const h = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Descartar venta" }));
    await user.click(screen.getByRole("button", { name: /Cobrar/ }));
    expect(h.onDiscard).toHaveBeenCalled();
    expect(h.onCharge).toHaveBeenCalled();
  });

  it("sin permiso de descartar no muestra el botón", () => {
    setup({ sale: sale({ actions: ["charge"] }) });
    expect(screen.queryByRole("button", { name: "Descartar venta" })).not.toBeInTheDocument();
  });
});
