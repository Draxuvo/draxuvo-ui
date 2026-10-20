import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Product } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/inventory", () => ({ inventoryService: { addMovement: vi.fn() } }));

import { inventoryService } from "@/services/inventory";
import { StockMovementDialog } from "../stock-movement-dialog";

const shrimp = {
  id: 9, sku: "CAM", name: "Camarón", stock: 10, min_stock: 2, unit_cost: 220, low_stock: false,
  product_type: { id: 3, name: "Insumo", sellable: false, counted: true, fractional: true },
  unit: { key: "kg", name: "Kilogramo" },
} as Product;
const beer = { ...shrimp, id: 10, name: "Corona", product_type: { id: 2, name: "Bebida", sellable: true, counted: true, fractional: false }, unit: { key: "pza", name: "Pieza" } } as Product;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryService.addMovement).mockResolvedValue({} as never);
});

describe("movimiento de inventario (spec 016)", () => {
  it("un insumo acepta 2.5 kg y muestra la unidad", async () => {
    renderWithProviders(<StockMovementDialog product={shrimp} movementType="exit" onOpenChange={() => {}} />);
    const user = userEvent.setup();
    expect(screen.getByText("Existencia actual: 10 kg")).toBeInTheDocument();

    const qty = screen.getByLabelText("Cantidad (Kilogramo)");
    await user.clear(qty);
    await user.type(qty, "2.5");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(inventoryService.addMovement).toHaveBeenCalledWith(9, expect.objectContaining({ movement_type: "exit", qty: 2.5 })));
  });

  it("una bebida pide piezas enteras", async () => {
    renderWithProviders(<StockMovementDialog product={beer} movementType="entry" onOpenChange={() => {}} />);
    const user = userEvent.setup();
    const qty = screen.getByLabelText("Cantidad (Pieza)");
    await user.clear(qty);
    await user.type(qty, "1.5");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Usa un número entero")).toBeInTheDocument();
    expect(inventoryService.addMovement).not.toHaveBeenCalled();
  });
});
