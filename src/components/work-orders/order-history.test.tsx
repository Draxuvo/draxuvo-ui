import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { WorkOrder, WorkOrderEvent } from "@/types";
import { OrderHistory } from "./order-history";

let nextId = 1;
function evento(kind: WorkOrderEvent["kind"], data: Record<string, unknown> = {}, actor: WorkOrderEvent["actor"] = { id: 1, name: "Ana" }): WorkOrderEvent {
  return { id: nextId++, kind, data, actor, created_at: "2026-03-05T14:30:00Z" };
}

function pinta(...events: WorkOrderEvent[]) {
  return renderWithProviders(<OrderHistory order={{ events } as WorkOrder} />);
}

describe("OrderHistory", () => {
  it("sin eventos muestra el estado vacío", () => {
    pinta();
    expect(screen.getByText("Sin movimientos")).toBeInTheDocument();
  });

  it("escribe una línea por cada tipo de evento", () => {
    pinta(
      evento("created"),
      evento("started"),
      evento("finished"),
      evento("reopened"),
      evento("photo"),
      evento("voided", { reason: "error de captura" }),
      evento("cancelled", { reason: "cliente se arrepintió" }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("Ana creó la orden")).toBeInTheDocument();
    expect(screen.getByText("Ana empezó la orden")).toBeInTheDocument();
    expect(screen.getByText("Ana terminó la orden")).toBeInTheDocument();
    expect(screen.getByText("Ana reabrió la orden")).toBeInTheDocument();
    expect(screen.getByText("Ana agregó una foto")).toBeInTheDocument();
    expect(screen.getByText("Ana anuló el cobro: error de captura")).toBeInTheDocument();
    expect(screen.getByText("Ana canceló la orden: cliente se arrepintió")).toBeInTheDocument();
  });

  it("al terminar con pasos sin marcar dice cuántos", () => {
    pinta(evento("finished", { pending_steps: 1 }), evento("finished", { pending_steps: 3 }));
    expect(screen.getByText("Ana terminó la orden con 1 paso sin marcar")).toBeInTheDocument();
    expect(screen.getByText("Ana terminó la orden con 3 pasos sin marcar")).toBeInTheDocument();
  });

  it("el cobro lleva folio y método de pago", () => {
    pinta(evento("charged", { folio: "T-0042", payment_method: "card" }));
    expect(screen.getByText("Ana cobró la orden. Folio T-0042, Tarjeta")).toBeInTheDocument();
  });

  it("cubre las tres variantes de reasignación", () => {
    pinta(
      evento("reassigned", { from: { name: "Luis" }, to: { name: "Marta" } }),
      evento("reassigned", { from: null, to: { name: "Marta" } }),
      evento("reassigned", { from: { name: "Luis" }, to: null }),
    );
    expect(screen.getByText("Ana reasignó la orden de Luis a Marta")).toBeInTheDocument();
    expect(screen.getByText("Ana asignó la orden a Marta")).toBeInTheDocument();
    expect(screen.getByText("Ana quitó el responsable (Luis)")).toBeInTheDocument();
  });

  it("una nota muestra su texto", () => {
    pinta(evento("note", { text: "Llamar al cliente mañana" }));
    expect(screen.getByText("Ana agregó una nota")).toBeInTheDocument();
    expect(screen.getByText("Llamar al cliente mañana")).toBeInTheDocument();
  });

  it("sin actor atribuye el movimiento al sistema", () => {
    pinta(evento("created", {}, null));
    expect(screen.getByText("Sistema creó la orden")).toBeInTheDocument();
  });
  it("cuenta los cambios de productos y los pagos anulados (spec 015)", () => {
    pinta(
      evento("item_added", { description: "Café", quantity: "2.0" }),
      evento("item_updated", { description: "Café", from_quantity: "2.0", to_quantity: "3.0" }),
      evento("item_removed", { description: "Pan", quantity: 1 }),
      evento("voided", { reason: "error", payments: [{ method: "card", amount: "300.0" }, { method: "cash", amount: 200 }] }),
    );
    expect(screen.getByText("Ana agregó 2 × Café")).toBeInTheDocument();
    expect(screen.getByText("Ana cambió Café de 2 a 3")).toBeInTheDocument();
    expect(screen.getByText("Ana quitó Pan")).toBeInTheDocument();
    expect(screen.getByText("Pagos anulados: Tarjeta $300.00, Efectivo $200.00")).toBeInTheDocument();
  });
});
