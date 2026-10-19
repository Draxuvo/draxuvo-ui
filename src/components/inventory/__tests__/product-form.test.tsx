import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/inventory", () => ({
  inventoryService: { create: vi.fn(), update: vi.fn(), getById: vi.fn() },
}));
vi.mock("@/services/restaurant", () => ({ restaurantService: { stations: vi.fn() } }));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: () => ({ enabled: true, isLocked: () => false }),
}));

import { inventoryService } from "@/services/inventory";
import { restaurantService } from "@/services/restaurant";
import { ProductForm } from "../product-form";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryService.create).mockResolvedValue({} as never);
});

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("PROD-001"), "TAC-1");
  await user.type(screen.getByPlaceholderText("Cemento 50kg"), "Tacos");
}

describe("formulario de producto con restaurante", () => {
  it("con el módulo ofrece estación y control de inventario, y los manda", async () => {
    vi.mocked(restaurantService.stations).mockResolvedValue([
      { id: 1, name: "Cocina", is_default: true, active: true, position: 1 },
      { id: 2, name: "Barra", is_default: false, active: true, position: 2 },
      { id: 3, name: "Vieja", is_default: false, active: false, position: 3 },
    ]);
    renderWithProviders(<ProductForm open onOpenChange={() => {}} />);
    const user = userEvent.setup();

    const select = await screen.findByLabelText("Estación");
    expect(screen.queryByRole("option", { name: "Vieja" })).not.toBeInTheDocument();
    await fillBasics(user);
    await user.selectOptions(select, "Barra");
    await user.click(screen.getByLabelText("Controla inventario"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(inventoryService.create).toHaveBeenCalled());
    expect(vi.mocked(inventoryService.create).mock.calls[0][0]).toMatchObject({ station_id: 2, tracks_stock: true });
  });

  it("sin elegir estación manda station_id nulo para usar la predeterminada", async () => {
    vi.mocked(restaurantService.stations).mockResolvedValue([{ id: 1, name: "Cocina", is_default: true, active: true, position: 1 }]);
    renderWithProviders(<ProductForm open onOpenChange={() => {}} />);
    const user = userEvent.setup();

    await screen.findByLabelText("Estación");
    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(inventoryService.create).toHaveBeenCalled());
    expect(vi.mocked(inventoryService.create).mock.calls[0][0]).toMatchObject({ station_id: null, tracks_stock: false });
  });

  it("sin el módulo no muestra la sección ni manda campos de restaurante", async () => {
    vi.mocked(restaurantService.stations).mockRejectedValue(new Error("403"));
    renderWithProviders(<ProductForm open onOpenChange={() => {}} />);
    const user = userEvent.setup();

    await fillBasics(user);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(inventoryService.create).toHaveBeenCalled());
    expect(screen.queryByLabelText("Estación")).not.toBeInTheDocument();
    expect(vi.mocked(inventoryService.create).mock.calls[0][0]).not.toHaveProperty("station_id");
  });
});
