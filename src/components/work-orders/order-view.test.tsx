import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { WorkOrder, WorkOrderAction } from "@/types";
import { OrderView } from "./order-view";

const useWorkOrder = vi.hoisted(() => vi.fn());
const mut = vi.hoisted(() => {
  const mk = () => ({ mutate: vi.fn(), isPending: false });
  return { base: mk(), start: mk(), finish: mk(), reopen: mk(), cancel: mk(), voidCharge: mk(), remove: mk() };
});
const replace = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-work-orders", () => ({
  useWorkOrder,
  useStartOrder: () => mut.start,
  useFinishOrder: () => mut.finish,
  useReopenOrder: () => mut.reopen,
  useCancelOrder: () => mut.cancel,
  useVoidCharge: () => mut.voidCharge,
  useDeleteWorkOrder: () => mut.remove,
  useAddNote: () => mut.base,
  useUploadPhoto: () => mut.base,
  useDeletePhoto: () => mut.base,
  useChargeOrder: () => mut.base,
  useAddStep: () => mut.base,
  useUpdateStep: () => mut.base,
  useDeleteStep: () => mut.base,
  useAddItem: () => mut.base,
  useUpdateItem: () => mut.base,
  useDeleteItem: () => mut.base,
}));
vi.mock("@/lib/api", () => ({ apiClient: { get: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }) }));
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

beforeEach(() => {
  useWorkOrder.mockReset();
  vi.clearAllMocks();
  for (const mutation of Object.values(mut)) mutation.isPending = false;
});

// Las llamadas a mutate llevan los callbacks como segundo argumento.
const callbacks = (mutation: { mutate: ReturnType<typeof vi.fn> }) => mutation.mutate.mock.calls.at(-1)![1] as { onSuccess: () => void; onError: (e: unknown) => void };
const dialogo = () => screen.getByRole("dialog");

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

  describe("cancelar la orden", () => {
    async function abre() {
      pinta(orden("open", ["cancel"]));
      await userEvent.click(botones("Cancelar orden")[0]);
    }

    it("pide el motivo y no deja confirmar sin escribirlo", async () => {
      await abre();
      expect(within(dialogo()).getByText("La orden quedará cancelada y no se podrá modificar. Escribe el motivo.")).toBeInTheDocument();
      const confirmar = within(dialogo()).getByRole("button", { name: "Cancelar orden" });
      expect(confirmar).toBeDisabled();
      await userEvent.type(within(dialogo()).getByLabelText("Motivo"), "   ");
      expect(confirmar).toBeDisabled();
    });

    it("con motivo cancela con el texto recortado y, si sale bien, avisa y cierra", async () => {
      await abre();
      await userEvent.type(within(dialogo()).getByLabelText("Motivo"), "  Cliente se arrepintió ");
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Cancelar orden" }));
      expect(mut.cancel.mutate).toHaveBeenCalledWith({ reason: "Cliente se arrepintió" }, expect.any(Object));
      expect(mut.voidCharge.mutate).not.toHaveBeenCalled();

      callbacks(mut.cancel).onSuccess();
      expect(toast.success).toHaveBeenCalledWith("Orden cancelada");
      await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("Mantener orden cierra sin cancelar", async () => {
      await abre();
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Mantener orden" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mut.cancel.mutate).not.toHaveBeenCalled();
    });

    it("si la API rechaza, avisa con el error y deja el diálogo abierto", async () => {
      await abre();
      await userEvent.type(within(dialogo()).getByLabelText("Motivo"), "Duplicada");
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Cancelar orden" }));
      callbacks(mut.cancel).onError({});
      expect(toast.error).toHaveBeenCalledWith("Esta acción ya no es posible. Se recargó la orden.");
      expect(dialogo()).toBeInTheDocument();
    });

    it("mientras se cancela no deja confirmar otra vez", async () => {
      mut.cancel.isPending = true;
      await abre();
      await userEvent.type(within(dialogo()).getByLabelText("Motivo"), "Duplicada");
      expect(within(dialogo()).getByRole("button", { name: "Cancelar orden" })).toBeDisabled();
    });
  });

  describe("anular el cobro", () => {
    async function abre() {
      pinta(orden("paid", ["void_charge"]));
      await userEvent.click(botones("Anular cobro")[0]);
    }

    it("usa la mutación de anular y no la de cancelar", async () => {
      await abre();
      expect(within(dialogo()).getByText("La orden volverá a Terminada y el ticket quedará anulado. Escribe el motivo.")).toBeInTheDocument();
      await userEvent.type(within(dialogo()).getByLabelText("Motivo"), "Cobro duplicado");
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Anular cobro" }));
      expect(mut.voidCharge.mutate).toHaveBeenCalledWith({ reason: "Cobro duplicado" }, expect.any(Object));
      expect(mut.cancel.mutate).not.toHaveBeenCalled();
      callbacks(mut.voidCharge).onSuccess();
      expect(toast.success).toHaveBeenCalledWith("Cobro anulado");
    });

    it("el botón de descartar se llama Ahora no", async () => {
      await abre();
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Ahora no" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mut.voidCharge.mutate).not.toHaveBeenCalled();
    });
  });

  describe("eliminar la orden", () => {
    async function abre() {
      pinta(orden("open", ["delete"]));
      await userEvent.click(botones("Eliminar")[0]);
    }

    it("nombra la orden y pide confirmar", async () => {
      await abre();
      expect(within(dialogo()).getByText('¿Seguro que quieres eliminar "Reparar fuga"? Esta acción no se puede deshacer.')).toBeInTheDocument();
      expect(mut.remove.mutate).not.toHaveBeenCalled();
    });

    it("al confirmar elimina por id y, si sale bien, avisa y regresa a la lista", async () => {
      await abre();
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Eliminar" }));
      expect(mut.remove.mutate).toHaveBeenCalledWith(1, expect.any(Object));
      callbacks(mut.remove).onSuccess();
      expect(toast.success).toHaveBeenCalledWith("Orden eliminada");
      expect(replace).toHaveBeenCalledWith("/ordenes");
    });

    it("Ahora no cierra sin eliminar", async () => {
      await abre();
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Ahora no" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mut.remove.mutate).not.toHaveBeenCalled();
    });

    it("mientras elimina el botón se bloquea y lo dice", async () => {
      mut.remove.isPending = true;
      await abre();
      expect(within(dialogo()).getByRole("button", { name: "Eliminando..." })).toBeDisabled();
    });
  });

  describe("terminar con pasos pendientes", () => {
    const conPasos = () => orden("in_progress", ["finish"], { steps_count: 3, steps_done: 1 });

    it("avisa cuántos pasos faltan antes de terminar", async () => {
      pinta(conPasos());
      await userEvent.click(botones("Terminar")[0]);
      expect(within(dialogo()).getByText("Quedan 2 pasos sin marcar. ¿Terminar de todos modos?")).toBeInTheDocument();
      expect(mut.finish.mutate).not.toHaveBeenCalled();
    });

    it("en singular cuando falta uno", async () => {
      pinta(orden("in_progress", ["finish"], { steps_count: 3, steps_done: 2 }));
      await userEvent.click(botones("Terminar")[0]);
      expect(within(dialogo()).getByText("Queda 1 paso sin marcar. ¿Terminar de todos modos?")).toBeInTheDocument();
    });

    it("Terminar de todos modos termina la orden", async () => {
      pinta(conPasos());
      await userEvent.click(botones("Terminar")[0]);
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Terminar de todos modos" }));
      expect(mut.finish.mutate).toHaveBeenCalledTimes(1);
      callbacks(mut.finish).onSuccess();
      expect(toast.success).toHaveBeenCalledWith("Orden terminada");
    });

    it("Ahora no deja la orden como estaba", async () => {
      pinta(conPasos());
      await userEvent.click(botones("Terminar")[0]);
      await userEvent.click(within(dialogo()).getByRole("button", { name: "Ahora no" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mut.finish.mutate).not.toHaveBeenCalled();
    });

    it("sin pasos pendientes termina directo, sin avisar", async () => {
      pinta(orden("in_progress", ["finish"], { steps_count: 2, steps_done: 2 }));
      await userEvent.click(botones("Terminar")[0]);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mut.finish.mutate).toHaveBeenCalledTimes(1);
    });

    it("si la orden no tiene conceptos, el error se explica", async () => {
      pinta(orden("in_progress", ["finish"]));
      await userEvent.click(botones("Terminar")[0]);
      callbacks(mut.finish).onError({ response: { data: { error: { details: { reason: "no_items" } } } } });
      expect(toast.error).toHaveBeenCalledWith("Agrega al menos un concepto con precio para cobrar");
    });
  });
});
