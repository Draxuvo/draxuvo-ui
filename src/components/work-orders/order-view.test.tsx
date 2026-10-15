import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { WorkOrder, WorkOrderAction } from "@/types";
import { OrderView } from "./order-view";

const useWorkOrder = vi.hoisted(() => vi.fn());
const mutation = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock("@/hooks/use-work-orders", () => ({
  useWorkOrder,
  useStartOrder: () => mutation,
  useFinishOrder: () => mutation,
  useReopenOrder: () => mutation,
  useCancelOrder: () => mutation,
  useVoidCharge: () => mutation,
  useDeleteWorkOrder: () => mutation,
  useAddNote: () => mutation,
  useUploadPhoto: () => mutation,
  useDeletePhoto: () => mutation,
  useChargeOrder: () => mutation,
  useAddStep: () => mutation,
  useUpdateStep: () => mutation,
  useDeleteStep: () => mutation,
  useAddItem: () => mutation,
  useUpdateItem: () => mutation,
  useDeleteItem: () => mutation,
}));
vi.mock("@/lib/api", () => ({ apiClient: { get: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function orden(status: WorkOrder["status"], actions: WorkOrderAction[], extra: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 1,
    title: "Reparar fuga",
    status,
    priority: "medium",
    total: 500,
    steps_count: 0,
    steps_done: 0,
    items: [],
    steps: [],
    events: [],
    photos: [],
    allowed_actions: actions,
    ...extra,
  } as WorkOrder;
}

function pinta(order: WorkOrder | undefined, opts: { error?: unknown; isLoading?: boolean } = {}) {
  useWorkOrder.mockReturnValue({ data: order, error: opts.error ?? null, isLoading: opts.isLoading ?? false, refetch: vi.fn() });
  return renderWithProviders(<OrderView id={1} backHref="/ordenes" />);
}

// La barra inferior y el panel lateral repiten los botones, así que se cuenta con getAll.
const botones = (nombre: string) => screen.queryAllByRole("button", { name: nombre });

beforeEach(() => useWorkOrder.mockReset());

describe("OrderView", () => {
  it("muestra el título y el estado de la orden", () => {
    pinta(orden("open", ["start"]));
    expect(screen.getByRole("heading", { level: 1, name: "Reparar fuga" })).toBeInTheDocument();
    expect(screen.getByText("Abierta")).toBeInTheDocument();
  });

  it("el empleado no ve Cancelar orden, Anular cobro ni Eliminar", () => {
    pinta(orden("done", ["charge", "add_note"]));
    expect(botones("Cancelar orden")).toHaveLength(0);
    expect(botones("Anular cobro")).toHaveLength(0);
    expect(botones("Eliminar")).toHaveLength(0);
  });

  it("el jefe sí ve las acciones destructivas que la API le permite", () => {
    pinta(orden("done", ["charge", "cancel", "delete"]));
    expect(botones("Cancelar orden").length).toBeGreaterThan(0);
    expect(botones("Eliminar").length).toBeGreaterThan(0);
    expect(botones("Anular cobro")).toHaveLength(0);
  });

  it("en una orden cobrada el jefe puede anular el cobro", () => {
    pinta(orden("paid", ["void_charge"]));
    expect(botones("Anular cobro").length).toBeGreaterThan(0);
  });

  it.each([
    ["open", ["start", "finish"], "Empezar"],
    ["in_progress", ["finish"], "Terminar"],
    ["done", ["charge"], "Cobrar"],
  ] as const)("en estado %s la acción principal es %s", (status, actions, principal) => {
    pinta(orden(status, [...actions]));
    expect(botones(principal).length).toBeGreaterThan(0);
  });

  it("si la orden se puede empezar, Terminar queda como acción secundaria", () => {
    pinta(orden("open", ["start", "finish"]));
    // Empezar aparece como principal en panel y barra; Terminar solo como secundaria.
    expect(botones("Empezar")).toHaveLength(2);
    expect(botones("Terminar").length).toBeGreaterThan(0);
  });

  it("sin acciones permitidas no hay acción principal", () => {
    pinta(orden("cancelled", []));
    for (const nombre of ["Empezar", "Terminar", "Cobrar", "Reabrir"]) expect(botones(nombre)).toHaveLength(0);
  });

  it("avisa que no se puede cobrar cuando la orden no tiene conceptos", () => {
    pinta(orden("done", [], { charge_blocked_reason: "no_items" }));
    expect(screen.getAllByText("Agrega al menos un concepto con precio para cobrar").length).toBeGreaterThan(0);
  });

  it("un 404 muestra el estado de no encontrada", () => {
    pinta(undefined, { error: { response: { status: 404 } } });
    expect(screen.getByRole("heading", { name: "No encontramos esta orden" })).toBeInTheDocument();
  });

  it("un error de red muestra el aviso y permite reintentar", () => {
    pinta(undefined, { error: new Error("red") });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("mientras carga muestra el esqueleto", () => {
    const { container } = pinta(undefined, { isLoading: true });
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });
});
