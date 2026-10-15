import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { WorkOrder, WorkOrderAction } from "@/types";
import { OrderSteps } from "./order-steps";

const addMutate = vi.hoisted(() => vi.fn());
const updateMutate = vi.hoisted(() => vi.fn());
const removeMutate = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-work-orders", () => ({
  useAddStep: () => ({ mutate: addMutate, isPending: false }),
  useUpdateStep: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteStep: () => ({ mutate: removeMutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function orden(actions: WorkOrderAction[]): WorkOrder {
  return {
    id: 7,
    steps_count: 2,
    steps_done: 1,
    allowed_actions: actions,
    steps: [
      { id: 1, description: "Cambiar filtro", position: 0, done: true },
      { id: 2, description: "Probar presión", position: 1, done: false },
    ],
  } as WorkOrder;
}

beforeEach(() => {
  addMutate.mockReset();
  updateMutate.mockReset();
  removeMutate.mockReset();
});

describe("OrderSteps", () => {
  it("muestra los pasos y el avance", () => {
    renderWithProviders(<OrderSteps order={orden([])} />);
    expect(screen.getByText("Cambiar filtro")).toBeInTheDocument();
    expect(screen.getByText("1 de 2 pasos")).toBeInTheDocument();
  });

  it("sin acciones permitidas las casillas están deshabilitadas y no hay editor", () => {
    renderWithProviders(<OrderSteps order={orden([])} />);
    screen.getAllByRole("checkbox").forEach((box) => expect(box).toBeDisabled());
    expect(screen.queryByRole("button", { name: "Agregar paso" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar paso" })).toBeNull();
  });

  it("con check_steps se puede marcar un paso", async () => {
    renderWithProviders(<OrderSteps order={orden(["check_steps"])} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Marcar paso: Probar presión" }));
    expect(updateMutate).toHaveBeenCalledWith({ stepId: 2, data: { done: true } });
    expect(screen.queryByRole("button", { name: "Agregar paso" })).toBeNull();
  });

  it("con edit_steps se pueden agregar y borrar pasos", async () => {
    renderWithProviders(<OrderSteps order={orden(["edit_steps"])} />);
    const agregar = screen.getByRole("button", { name: "Agregar paso" });
    expect(agregar).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Agregar paso" }), "  Limpiar  ");
    await userEvent.click(agregar);
    expect(addMutate).toHaveBeenCalledWith({ description: "Limpiar", position: 2 }, expect.any(Object));
    await userEvent.click(screen.getAllByRole("button", { name: "Quitar paso" })[0]);
    expect(removeMutate).toHaveBeenCalledWith(1);
  });

  it("sin pasos muestra el estado vacío", () => {
    renderWithProviders(<OrderSteps order={{ ...orden([]), steps: [], steps_count: 0, steps_done: 0 }} />);
    expect(screen.getByText("Sin pasos")).toBeInTheDocument();
  });
});
