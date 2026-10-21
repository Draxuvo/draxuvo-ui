import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { ProductType } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/inventory", () => ({
  inventoryService: { create: vi.fn(), update: vi.fn(), getById: vi.fn() },
}));
vi.mock("@/services/restaurant", () => ({ restaurantService: { stations: vi.fn() } }));
vi.mock("@/services/product-types", () => ({ productTypesService: { list: vi.fn(), units: vi.fn() } }));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: () => ({ enabled: true, isLocked: () => false }),
}));

import { inventoryService } from "@/services/inventory";
import { restaurantService } from "@/services/restaurant";
import { productTypesService } from "@/services/product-types";
import { ProductForm } from "../product-form";

const type = (id: number, name: string, sellable: boolean, counted: boolean, fractional = false, unit = "pza"): ProductType => ({
  id, name, sellable, counted, fractional, kind: null, active: true, position: id, products_count: 0,
  default_unit: { key: unit, name: unit === "kg" ? "Kilogramo" : "Pieza" },
});
const TYPES = [type(1, "Platillo", true, false), type(2, "Bebida", true, true), type(3, "Insumo", false, true, true, "kg")];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryService.create).mockResolvedValue({} as never);
  vi.mocked(productTypesService.list).mockResolvedValue(TYPES);
  vi.mocked(productTypesService.units).mockResolvedValue([{ key: "pza", name: "Pieza" }, { key: "kg", name: "Kilogramo" }]);
  vi.mocked(restaurantService.stations).mockResolvedValue([
    { id: 1, name: "Cocina", is_default: true, active: true, position: 1 },
    { id: 2, name: "Barra", is_default: false, active: true, position: 2 },
    { id: 3, name: "Vieja", is_default: false, active: false, position: 3 },
  ]);
});

async function fill(user: ReturnType<typeof userEvent.setup>, typeName: string) {
  await screen.findByRole("option", { name: typeName });
  await user.selectOptions(screen.getByLabelText("Tipo"), typeName);
  await user.type(screen.getByPlaceholderText("PROD-001"), "P-1");
  await user.type(screen.getByPlaceholderText("Cemento 50kg"), "Producto");
}

describe("formulario de producto según su tipo (spec 016)", () => {
  it("un platillo pide precio y estación, sin existencia, y manda su tipo", async () => {
    renderWithProviders(<ProductForm open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await fill(user, "Platillo");

    expect(screen.queryByLabelText("Stock")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Vieja" })).not.toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText("Estación"), "Barra");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(inventoryService.create).toHaveBeenCalled());
    const payload = vi.mocked(inventoryService.create).mock.calls[0][0];
    expect(payload).toMatchObject({ product_type_id: 1, station_id: 2 });
    expect(payload).not.toHaveProperty("stock");
    expect(payload).not.toHaveProperty("tracks_stock");
  });

  it("un insumo pide existencia con decimales y unidad, sin precio ni estación", async () => {
    renderWithProviders(<ProductForm open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await fill(user, "Insumo");

    expect(screen.queryByLabelText("Precio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Estación")).not.toBeInTheDocument();
    const stock = screen.getByLabelText("Stock");
    await user.clear(stock);
    await user.type(stock, "2.5");
    await user.selectOptions(screen.getByLabelText("Unidad"), "kg");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(inventoryService.create).toHaveBeenCalled());
    const payload = vi.mocked(inventoryService.create).mock.calls[0][0];
    expect(payload).toMatchObject({ product_type_id: 3, stock: 2.5, unit_key: "kg" });
    expect(payload).not.toHaveProperty("price");
  });

  it("una bebida rechaza existencias con fracción", async () => {
    renderWithProviders(<ProductForm open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await fill(user, "Bebida");

    const stock = screen.getByLabelText("Stock");
    await user.clear(stock);
    await user.type(stock, "1.5");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Usa un número entero")).toBeInTheDocument();
    expect(inventoryService.create).not.toHaveBeenCalled();
  });

  it("sin tipo no se guarda", async () => {
    renderWithProviders(<ProductForm open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "Platillo" });
    await user.type(screen.getByPlaceholderText("PROD-001"), "P-1");
    await user.type(screen.getByPlaceholderText("Cemento 50kg"), "Producto");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Elige el tipo de producto")).toBeInTheDocument();
    expect(inventoryService.create).not.toHaveBeenCalled();
  });
});

describe("icono del producto (spec 026)", () => {
  it("sin permiso no hay selector de icono ni se manda el campo", async () => {
    renderWithProviders(<ProductForm open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await fill(user, "Platillo");
    expect(screen.queryByRole("button", { name: "Elegir icono" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(inventoryService.create).toHaveBeenCalled());
    expect(vi.mocked(inventoryService.create).mock.calls[0][0]).not.toHaveProperty("icon");
  });

  it("administrador y dueño eligen el icono y se manda con el producto", async () => {
    renderWithProviders(<ProductForm open onOpenChange={() => {}} canEditIcon />);
    const user = userEvent.setup();
    await fill(user, "Platillo");
    await user.click(screen.getByRole("button", { name: "Elegir icono" }));
    await user.click(screen.getByRole("button", { name: "Taco" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(inventoryService.create).toHaveBeenCalled());
    expect(vi.mocked(inventoryService.create).mock.calls[0][0]).toMatchObject({ icon: "taco" });
  });
});

