import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { ProductType } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/product-types", () => ({
  productTypesService: { list: vi.fn(), units: vi.fn(), create: vi.fn(), update: vi.fn(), destroy: vi.fn(), moveProducts: vi.fn() },
}));

import { productTypesService } from "@/services/product-types";
import { ProductTypesSheet } from "./product-types-sheet";

const type = (id: number, name: string, sellable: boolean, counted: boolean, products: number): ProductType => ({
  id, name, sellable, counted, fractional: false, kind: null, active: true, position: id, products_count: products,
  default_unit: { key: "pza", name: "Pieza" },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(productTypesService.list).mockResolvedValue([type(1, "Platillo", true, false, 35), type(2, "Bebida", true, true, 0)]);
  vi.mocked(productTypesService.units).mockResolvedValue([{ key: "pza", name: "Pieza" }, { key: "kg", name: "Kilogramo" }]);
  vi.mocked(productTypesService.create).mockResolvedValue(type(3, "Postre", true, true, 0));
  vi.mocked(productTypesService.moveProducts).mockResolvedValue({ moved: 35 });
});

describe("tipos de producto (spec 016)", () => {
  it("crea un tipo con sus reglas; decimales solo si se cuenta", async () => {
    renderWithProviders(<ProductTypesSheet open onOpenChange={() => {}} canManage />);
    const user = userEvent.setup();
    expect(await screen.findByText(/Se vende · No se cuenta · Pieza · 35 productos/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nuevo tipo" }));
    await user.type(screen.getByLabelText("Nombre"), "Postre");
    expect(screen.getByRole("switch", { name: "Admite decimales" })).toBeDisabled();
    await user.click(screen.getByRole("switch", { name: "Se cuenta" }));
    expect(screen.getByRole("switch", { name: "Admite decimales" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(productTypesService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Postre", sellable: true, counted: true, fractional: false, default_unit_key: "pza" }),
      ),
    );
  });

  it("un tipo con productos ofrece moverlos en lugar de borrar", async () => {
    renderWithProviders(<ProductTypesSheet open onOpenChange={() => {}} canManage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Borrar Platillo" }));

    expect(screen.getByText("Platillo tiene productos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mover productos" }));
    await waitFor(() => expect(productTypesService.moveProducts).toHaveBeenCalledWith(1, 2));
  });

  it("sin permisos solo muestra la lista", async () => {
    renderWithProviders(<ProductTypesSheet open onOpenChange={() => {}} canManage={false} />);
    expect(await screen.findByText("Platillo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo tipo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Platillo" })).not.toBeInTheDocument();
  });
});
