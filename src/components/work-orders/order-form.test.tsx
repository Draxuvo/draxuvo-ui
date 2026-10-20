import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { OrderForm } from "./order-form";

const createMutate = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
const employeesList = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({ apiClient: { get }, expectModuleLock: () => () => {} }));
vi.mock("@/services/employees", () => ({ employeesService: { list: employeesList } }));
vi.mock("@/hooks/use-work-orders", () => ({
  useCreateWorkOrder: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateWorkOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  createMutate.mockReset().mockResolvedValue({ id: 41 });
  push.mockReset();
  employeesList.mockReset().mockResolvedValue({ results: [{ id: 9, name: "Luis" }] });
  get.mockReset().mockResolvedValue({ data: { results: [{ id: 7, name: "Café americano", price: 35, category: "Bebidas" }] } });
});

describe("OrderForm del operador (spec 015)", () => {
  it("no muestra precio, asignación ni más detalles, y manda solo producto y cantidad", async () => {
    renderWithProviders(<OrderForm open onOpenChange={() => {}} staff />);

    expect(screen.queryByLabelText("Precio")).not.toBeInTheDocument();
    expect(screen.queryByText("Responsable")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Más detalles" })).not.toBeInTheDocument();
    expect(employeesList).not.toHaveBeenCalled();

    await userEvent.type(screen.getByPlaceholderText("Instalación eléctrica, Reparación de..."), "Mostrador");
    await userEvent.click(screen.getByRole("button", { name: "Agregar concepto" }));
    await screen.findByRole("option", { name: "Café americano" });
    await userEvent.selectOptions(screen.getByLabelText("Producto del catálogo"), "7");
    const quantity = screen.getByLabelText("Cantidad");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "2");
    await userEvent.click(screen.getByRole("button", { name: "Crear orden" }));

    expect(createMutate).toHaveBeenCalledWith({
      work_order: { title: "Mostrador", customer_name: null, customer_phone: null },
      items: [{ product_id: 7, quantity: 2 }],
    });
    expect(push).toHaveBeenCalledWith("/mis-ordenes/41");
  });

  it("no deja guardar un renglón sin producto", async () => {
    renderWithProviders(<OrderForm open onOpenChange={() => {}} staff />);
    await userEvent.type(screen.getByPlaceholderText("Instalación eléctrica, Reparación de..."), "Mostrador");
    await userEvent.click(screen.getByRole("button", { name: "Agregar concepto" }));
    const quantity = screen.getByLabelText("Cantidad");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "3");
    await userEvent.click(screen.getByRole("button", { name: "Crear orden" }));

    expect(await screen.findByText("Elige un producto y una cantidad mayor que cero")).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });
});
