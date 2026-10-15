import { createElement, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "@/test/render";

vi.mock("@/lib/api", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import * as wo from "./use-work-orders";

const api = vi.mocked(apiClient);
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

const order = { id: 7, status: "in_progress" };

beforeEach(() => {
  vi.clearAllMocks();
  client = createTestQueryClient();
  useAuthStore.setState({ selectedCompanyId: 3 });
  for (const m of ["get", "post", "put", "patch", "delete"] as const) {
    api[m].mockResolvedValue({ data: order } as never);
  }
});

describe("listWorkOrders", () => {
  it("usa page 1 y page_size 20 por defecto", async () => {
    await wo.listWorkOrders();
    expect(api.get).toHaveBeenCalledWith("/api/v1/work_orders", {
      params: expect.objectContaining({ page: 1, page_size: 20, search: undefined, unassigned: undefined }),
    });
  });

  it("recorta la búsqueda y convierte búsqueda vacía o unassigned falso en undefined", async () => {
    await wo.listWorkOrders({ search: "  luz  ", unassigned: false } as never);
    const params = api.get.mock.calls[0][1]!.params;
    expect(params.search).toBe("luz");
    expect(params.unassigned).toBeUndefined();
    await wo.listWorkOrders({ search: "   " } as never);
    expect(api.get.mock.calls[1][1]!.params.search).toBeUndefined();
  });

  it("pasa los filtros y unassigned verdadero", async () => {
    await wo.listWorkOrders({
      status: "open",
      priority: "high",
      employee_id: 4,
      unassigned: true,
      paid_on: "2026-01-02",
      sort_by: "created_at",
      page: 2,
      page_size: 5,
    } as never);
    expect(api.get.mock.calls[0][1]!.params).toEqual({
      page: 2,
      page_size: 5,
      status: "open",
      priority: "high",
      employee_id: 4,
      search: undefined,
      unassigned: true,
      paid_on: "2026-01-02",
      sort_by: "created_at",
    });
  });
});

describe("consultas", () => {
  it("useWorkOrders consulta con la key de filtros y página", async () => {
    api.get.mockResolvedValue({ data: { results: [] } } as never);
    const { result } = renderHook(() => wo.useWorkOrders({ status: "open" } as never, { page: 2 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get.mock.calls[0][1]!.params).toMatchObject({ status: "open", page: 2, page_size: 20 });
    expect(client.getQueryData(["work-orders", { status: "open" }, 2, 20])).toEqual({ results: [] });
  });

  it("useWorkOrders no consulta con enabled:false", () => {
    renderHook(() => wo.useWorkOrders({}, {}, { enabled: false }), { wrapper });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("useWorkOrder consulta el detalle y se salta el id 0", async () => {
    const { result } = renderHook(() => wo.useWorkOrder(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/api/v1/work_orders/7");
    api.get.mockClear();
    renderHook(() => wo.useWorkOrder(0), { wrapper });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("useWorkOrderSummary consulta /summary", async () => {
    const { result } = renderHook(() => wo.useWorkOrderSummary(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/api/v1/work_orders/summary");
  });
});

describe("transiciones", () => {
  const cases = [
    ["start", wo.useStartOrder, false],
    ["finish", wo.useFinishOrder, false],
    ["reopen", wo.useReopenOrder, false],
    ["cancel", wo.useCancelOrder, false],
    ["charge", wo.useChargeOrder, true],
    ["void_charge", wo.useVoidCharge, true],
  ] as const;

  it.each(cases)("%s hace POST a la acción, actualiza el detalle e invalida lo correcto", async (action, hook, tickets) => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => hook(7), { wrapper });
    await act(() => result.current.mutateAsync({ payment_method: "cash" }));

    expect(api.post).toHaveBeenCalledWith(`/api/v1/work_orders/7/${action}`, { payment_method: "cash" });
    expect(client.getQueryData(["work-orders", 7])).toEqual(order);
    const keys = spy.mock.calls.map((c) => c[0]!.queryKey);
    expect(keys).toContainEqual(["work-orders"]);
    expect(keys).toContainEqual(["dashboard", 3]);
    expect(keys.some((k) => k![0] === "tickets")).toBe(tickets);
  });

  it("sin cuerpo envía un objeto vacío", async () => {
    const { result } = renderHook(() => wo.useStartOrder(7), { wrapper });
    await act(() => result.current.mutateAsync(undefined));
    expect(api.post).toHaveBeenCalledWith("/api/v1/work_orders/7/start", {});
  });
});

describe("CRUD de órdenes", () => {
  it("crear hace POST y fija el detalle de la orden nueva", async () => {
    const { result } = renderHook(() => wo.useCreateWorkOrder(), { wrapper });
    await act(() => result.current.mutateAsync({ title: "x" }));
    expect(api.post).toHaveBeenCalledWith("/api/v1/work_orders", { title: "x" });
    expect(client.getQueryData(["work-orders", 7])).toEqual(order);
  });

  it("actualizar hace PUT al id", async () => {
    const { result } = renderHook(() => wo.useUpdateWorkOrder(7), { wrapper });
    await act(() => result.current.mutateAsync({ title: "y" }));
    expect(api.put).toHaveBeenCalledWith("/api/v1/work_orders/7", { title: "y" });
    expect(client.getQueryData(["work-orders", 7])).toEqual(order);
  });

  it("eliminar hace DELETE, quita el detalle e invalida la lista y el dashboard", async () => {
    client.setQueryData(["work-orders", 7], order);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => wo.useDeleteWorkOrder(), { wrapper });
    await act(() => result.current.mutateAsync(7));
    expect(api.delete).toHaveBeenCalledWith("/api/v1/work_orders/7");
    expect(client.getQueryData(["work-orders", 7])).toBeUndefined();
    const keys = spy.mock.calls.map((c) => c[0]!.queryKey);
    expect(keys).toContainEqual(["work-orders"]);
    expect(keys).toContainEqual(["dashboard", 3]);
  });
});

describe("conceptos, pasos, notas y fotos", () => {
  type Case = [string, () => { mutateAsync: (v: never) => Promise<unknown> }, unknown, "post" | "patch" | "delete", string, unknown[]];
  const cases: Case[] = [
    ["agregar concepto", () => wo.useAddItem(7), { name: "a" }, "post", "/api/v1/work_orders/7/items", [{ name: "a" }]],
    ["editar concepto", () => wo.useUpdateItem(7), { itemId: 2, data: { qty: 3 } }, "patch", "/api/v1/work_orders/7/items/2", [{ qty: 3 }]],
    ["borrar concepto", () => wo.useDeleteItem(7), 2, "delete", "/api/v1/work_orders/7/items/2", []],
    ["agregar paso", () => wo.useAddStep(7), { description: "d" }, "post", "/api/v1/work_orders/7/steps", [{ description: "d" }]],
    ["marcar paso", () => wo.useUpdateStep(7), { stepId: 4, data: { done: true } }, "patch", "/api/v1/work_orders/7/steps/4", [{ done: true }]],
    ["borrar paso", () => wo.useDeleteStep(7), 4, "delete", "/api/v1/work_orders/7/steps/4", []],
    ["agregar nota", () => wo.useAddNote(7), "hola", "post", "/api/v1/work_orders/7/notes", [{ text: "hola" }]],
    ["borrar foto", () => wo.useDeletePhoto(7), 9, "delete", "/api/v1/work_orders/7/photos/9", []],
  ];

  it.each(cases)("%s llama al endpoint correcto y refresca detalle, lista y dashboard", async (_n, hook, input, method, url, rest) => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(hook, { wrapper });
    await act(() => result.current.mutateAsync(input as never));

    expect(api[method]).toHaveBeenCalledWith(url, ...rest);
    expect(client.getQueryData(["work-orders", 7])).toEqual(order);
    const keys = spy.mock.calls.map((c) => c[0]!.queryKey);
    expect(keys).toContainEqual(["work-orders"]);
    expect(keys).toContainEqual(["dashboard", 3]);
    expect(keys.some((k) => k![0] === "tickets")).toBe(false);
  });

  it("subir foto envía multipart con archivo y descripción", async () => {
    const { result } = renderHook(() => wo.useUploadPhoto(7), { wrapper });
    const file = new File(["x"], "f.png", { type: "image/png" });
    await act(() => result.current.mutateAsync({ file, description: "antes" }));

    const [url, form, config] = api.post.mock.calls[0];
    expect(url).toBe("/api/v1/work_orders/7/photos");
    expect((form as FormData).get("file")).toBeInstanceOf(File);
    expect((form as FormData).get("description")).toBe("antes");
    expect(config).toEqual({ headers: { "Content-Type": "multipart/form-data" } });
  });

  it("subir foto sin descripción no la agrega", async () => {
    const { result } = renderHook(() => wo.useUploadPhoto(7), { wrapper });
    await act(() => result.current.mutateAsync({ file: new File(["x"], "f.png") }));
    expect((api.post.mock.calls[0][1] as FormData).has("description")).toBe(false);
  });
});

describe("useUpdateOrderMode", () => {
  it("hace PATCH al modo, actualiza la empresa activa y recarga al usuario", async () => {
    const setUser = vi.fn();
    const fetchMe = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: 1,
      companies: [
        { id: 3, order_mode: "simple" },
        { id: 4, order_mode: "simple" },
      ],
    };
    useAuthStore.setState({ user: user as never, selectedCompanyId: 3, setUser, fetchMe } as never);
    api.patch.mockResolvedValue({ data: { order_mode: "full" } } as never);

    const { result } = renderHook(() => wo.useUpdateOrderMode(), { wrapper });
    await act(() => result.current.mutateAsync("full" as never));

    expect(api.patch).toHaveBeenCalledWith("/api/v1/company/order_mode", { order_mode: "full" });
    expect(setUser).toHaveBeenCalledWith({
      ...user,
      companies: [
        { id: 3, order_mode: "full" },
        { id: 4, order_mode: "simple" },
      ],
    });
    expect(fetchMe).toHaveBeenCalled();
  });
});
