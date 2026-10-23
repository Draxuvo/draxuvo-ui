import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Product } from "@/types";

vi.mock("@/services/inventory", () => ({ inventoryService: { generateProductBarcodes: vi.fn() } }));

import { inventoryService } from "@/services/inventory";
import { GenerateBarcodesDialog } from "../generate-barcodes-dialog";

const product = (id: number, barcodes: string[]): Product => ({ id, sku: `S-${id}`, name: `P${id}`, barcodes }) as Product;

beforeEach(() => vi.clearAllMocks());

describe("GenerateBarcodesDialog (spec 035)", () => {
  it("cuenta cuántos productos recibirán código y manda toda la selección", async () => {
    vi.mocked(inventoryService.generateProductBarcodes).mockResolvedValue({ generated: 2, already_had: 1, failed: [], products: [] });
    renderWithProviders(<GenerateBarcodesDialog open products={[product(1, []), product(2, []), product(3, ["111"])]} onOpenChange={vi.fn()} />);
    const user = userEvent.setup();

    expect(screen.getByText(/Se generará un código para 2 productos sin código \(de 3 seleccionados\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Generar 2 códigos" }));

    await waitFor(() => expect(inventoryService.generateProductBarcodes).toHaveBeenCalledWith([1, 2, 3]));
  });

  it("muestra el resumen con generados, ya tenían y fallidos", async () => {
    vi.mocked(inventoryService.generateProductBarcodes).mockResolvedValue({
      generated: 2, already_had: 1, failed: [{ product_id: 9, reason: "not_found" }], products: [],
    });
    renderWithProviders(<GenerateBarcodesDialog open products={[product(1, []), product(2, [])]} onOpenChange={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Generar 2 códigos" }));

    const summary = await screen.findByLabelText("Resumen de la generación");
    expect(summary).toHaveTextContent("Generados2");
    expect(summary).toHaveTextContent("Ya tenían1");
    expect(summary).toHaveTextContent("Fallidos1");
    expect(screen.getByRole("alert")).toHaveTextContent("1 producto no se encontró.");
  });

  it("si todos ya tienen código no hay nada que generar", () => {
    renderWithProviders(<GenerateBarcodesDialog open products={[product(1, ["111"]), product(2, ["222"])]} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Todos los 2 productos ya tienen código/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generar 0 códigos/ })).toBeDisabled();
  });

  it("cancelar cierra sin llamar a la API", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<GenerateBarcodesDialog open products={[product(1, [])]} onOpenChange={onOpenChange} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(inventoryService.generateProductBarcodes).not.toHaveBeenCalled();
  });
});
