import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Sale, SaleChargeResult } from "@/types";

vi.mock("@/services/sales", () => ({ salesService: { charge: vi.fn() } }));
vi.mock("@/hooks/use-payment-terminals", () => ({ usePaymentTerminals: () => ({ data: [] }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { salesService } from "@/services/sales";
import { PosChargeDialog } from "../pos-charge-dialog";

const sale: Sale = {
  id: 7, status: "open", status_label: "Abierta", total: "85.00", items_count: 1, opened_by: null, charged_by: null, paid_at: null,
  cancelled_at: null, cancelled_by: null, cancel_reason: null, lock_version: 3, created_at: "2026-11-03T10:00:00Z", folio: null,
  actions: ["charge"], items: [], ticket: null,
};

const paid = (over: Partial<SaleChargeResult> = {}): SaleChargeResult => ({
  sale: { ...sale, status: "paid", ticket: { id: 9, folio: "T-000009", change_given: "15.00" } as never },
  shortages: [], ...over,
});

function setup() {
  const onOpenChange = vi.fn();
  const onDone = vi.fn();
  renderWithProviders(<PosChargeDialog sale={sale} open onOpenChange={onOpenChange} onDone={onDone} />);
  return { onOpenChange, onDone };
}

beforeEach(() => vi.clearAllMocks());

describe("cobro de la venta (spec 050)", () => {
  it("efectivo: pide lo recibido, muestra el cambio y manda el cobro con la versión de la venta", async () => {
    vi.mocked(salesService.charge).mockResolvedValue(paid());
    setup();
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
    await user.type(screen.getByLabelText("Recibido"), "100");
    expect(screen.getByText("Cambio: $15.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() => expect(salesService.charge).toHaveBeenCalled());
    const [id, payload, key] = vi.mocked(salesService.charge).mock.calls[0];
    expect(id).toBe(7);
    expect(payload).toEqual({ lock_version: 3, payments: [{ method: "cash", amount_received: 100 }] });
    expect(typeof key).toBe("string");
    expect(await screen.findByText("Folio T-000009")).toBeInTheDocument();
    expect(screen.getByText("Cambio: $15.00")).toBeInTheDocument();
  });

  it("no deja confirmar con efectivo insuficiente", async () => {
    setup();
    await userEvent.setup().type(screen.getByLabelText("Recibido"), "50");
    expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  });

  it("avisa de las piezas que faltaron en el inventario", async () => {
    vi.mocked(salesService.charge).mockResolvedValue(paid({ shortages: [{ product_id: 2, name: "Pluma azul", missing: 2 }] }));
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Recibido"), "85");
    await user.click(screen.getByRole("button", { name: "Confirmar cobro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Pluma azul: faltaron 2");
  });

  it("al terminar avisa con el resultado para pasar a una venta nueva", async () => {
    vi.mocked(salesService.charge).mockResolvedValue(paid());
    const { onDone, onOpenChange } = setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Recibido"), "85");
    await user.click(screen.getByRole("button", { name: "Confirmar cobro" }));
    await user.click(await screen.findByRole("button", { name: "Nueva venta" }));

    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ shortages: [] }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("una venta que cambió muestra el aviso de conflicto", async () => {
    vi.mocked(salesService.charge).mockRejectedValue({ response: { data: { error: { details: { code: "stale_object" } } } } });
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Recibido"), "85");
    await user.click(screen.getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La venta cambió. Revísala y vuelve a cobrar."));
  });

  it("un error de pago usa el mensaje del cobro de órdenes", async () => {
    vi.mocked(salesService.charge).mockRejectedValue({ response: { data: { error: { details: { code: "missing" } } } } });
    setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Recibido"), "85");
    await user.click(screen.getByRole("button", { name: "Confirmar cobro" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("cancelar cierra sin cobrar", async () => {
    const { onOpenChange } = setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(salesService.charge).not.toHaveBeenCalled();
  });
});
