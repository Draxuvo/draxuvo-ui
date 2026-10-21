import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { WorkOrder, WorkOrderAction } from "@/types";
import { OrderItems } from "./order-items";

const addMutate = vi.hoisted(() => vi.fn());
const updateMutate = vi.hoisted(() => vi.fn());
const removeMutate = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({ apiClient: { get } }));
vi.mock("@/hooks/use-work-orders", () => ({
  useAddItem: () => ({ mutate: addMutate, isPending: false }),
  useUpdateItem: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteItem: () => ({ mutate: removeMutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function orden(actions: WorkOrderAction[]): WorkOrder {
  return {
    id: 3,
    total: 850,
    allowed_actions: actions,
    items: [
      { id: 1, description: "Mano de obra", quantity: 2, unit: "hr", unit_price: 300, subtotal: 600, position: 0 },
      { id: 2, description: "Refacción", quantity: 1, unit: "pza", unit_price: 250, subtotal: 250, position: 1 },
    ],
  } as WorkOrder;
}

beforeEach(() => {
  addMutate.mockReset();
  updateMutate.mockReset();
  removeMutate.mockReset();
  get.mockReset();
  get.mockResolvedValue({ data: { results: [{ id: 9, name: "Aceite", sku: "AC-1", price: 120, icon: "bolt" }] } });
});

describe("OrderItems", () => {
  it("muestra los conceptos, sus importes y el total", () => {
    renderWithProviders(<OrderItems order={orden([])} />);
    expect(screen.getByText("Mano de obra")).toBeInTheDocument();
    expect(screen.getByText("$600.00")).toBeInTheDocument();
    expect(screen.getByText("$850.00")).toBeInTheDocument();
  });

  it("sin acciones solo se lee: no hay agregar, precio editable ni borrar", () => {
    renderWithProviders(<OrderItems order={orden([])} />);
    expect(screen.queryByLabelText("Producto del catálogo")).toBeNull();
    expect(screen.queryAllByLabelText("Editar precio")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Quitar / })).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("el empleado con add_item agrega solo del catálogo y sin campo de precio", async () => {
    renderWithProviders(<OrderItems order={orden(["add_item"])} />);
    expect(screen.queryByLabelText("Precio")).toBeNull();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
    expect(screen.queryAllByLabelText("Editar precio")).toHaveLength(0);
    await userEvent.click(screen.getByLabelText("Producto del catálogo"));
    await userEvent.click(await screen.findByRole("button", { name: /Aceite/ }));
    await userEvent.click(screen.getByRole("button", { name: "Agregar concepto" }));
    expect(addMutate).toHaveBeenCalledWith({ product_id: 9, quantity: 1 }, expect.any(Object));
  });

  it("el jefe con edit_items edita el precio, borra y agrega conceptos libres", async () => {
    renderWithProviders(<OrderItems order={orden(["add_item", "edit_items"])} />);
    const precio = screen.getAllByLabelText("Editar precio")[0];
    await userEvent.clear(precio);
    await userEvent.type(precio, "320");
    await userEvent.tab();
    expect(updateMutate).toHaveBeenCalledWith({ itemId: 1, data: { unit_price: 320 } });

    await userEvent.click(screen.getByRole("button", { name: "Quitar Refacción" }));
    expect(removeMutate).toHaveBeenCalledWith(2);

    await userEvent.type(screen.getByLabelText("Descripción"), "Traslado");
    await userEvent.type(screen.getByLabelText("Precio"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Concepto libre" }));
    expect(addMutate).toHaveBeenCalledWith({ description: "Traslado", quantity: 1, unit_price: 100 }, expect.any(Object));
  });

  it("sin conceptos muestra el estado vacío", () => {
    renderWithProviders(<OrderItems order={{ ...orden([]), items: [], total: 0 }} />);
    expect(screen.getByText("Sin conceptos")).toBeInTheDocument();
  });
  it("con change_items el asignado cambia la cantidad y quita, pero no ve el precio editable", async () => {
    renderWithProviders(<OrderItems order={orden(["change_items"])} />);
    expect(screen.queryByLabelText("Editar precio")).not.toBeInTheDocument();
    const quantity = screen.getByLabelText("Cantidad de Mano de obra");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "4");
    await userEvent.tab();
    expect(updateMutate).toHaveBeenCalledWith({ itemId: 1, data: { quantity: 4 } });

    await userEvent.click(screen.getByRole("button", { name: /Refacción/ }));
    expect(removeMutate).toHaveBeenCalledWith(2);
  });
});
