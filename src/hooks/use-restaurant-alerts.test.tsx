import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "@/test/render";
import type { CheckSummary, ReadyItem, TablesResponse, TableSummary } from "@/types";

vi.mock("@/services/restaurant", () => ({ restaurantService: { overview: vi.fn() } }));

import { restaurantService } from "@/services/restaurant";
import { useRestaurantAlerts } from "./use-restaurant-alerts";

const overview = (over: Partial<TablesResponse> = {}): TablesResponse => ({
  results: [], takeouts: [], ready_items: [], ...over,
});

const ready = (id: number, name = "Tacos al pastor", table: string | null = "4"): ReadyItem => ({
  id, name, quantity: 1, check_id: 31, table, takeout_name: null, ready_at: "2026-10-19T19:00:00Z",
});

const check = (id: number, over: Partial<CheckSummary> = {}): CheckSummary => ({
  id, opened_at: "2026-10-19T18:00:00Z", total: "120.00", counts: { new: 0, preparing: 0, ready: 0, delivered: 2 }, mine: true, ...over,
});

const table = (id: number, name: string, state: TableSummary["state"], own: CheckSummary | null): TableSummary => ({
  id, name, active: true, position: id, state, check: own,
});

function setup() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}

/** Espera a que el primer sondeo llegue, para que "no avisa" signifique algo. */
async function loaded(queryClient: ReturnType<typeof createTestQueryClient>) {
  await waitFor(() => expect(queryClient.getQueryData(["restaurant", "overview", undefined])).toBeTruthy());
}

async function poll(queryClient: ReturnType<typeof createTestQueryClient>) {
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["restaurant", "overview"] });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("avisos operativos del restaurante", () => {
  it("no avisa por lo que ya estaba así al abrir la pantalla", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(
      overview({ ready_items: [ready(1)], results: [table(4, "Mesa 4", "to_pay", check(31))] }),
    );
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestaurantAlerts(), { wrapper });

    await loaded(queryClient);
    expect(result.current.alerts).toEqual([]);
  });

  it("avisa cuando un artículo pasa a listo", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(overview());
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestaurantAlerts(), { wrapper });
    await loaded(queryClient);

    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ ready_items: [ready(1)] }));
    await poll(queryClient);

    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    expect(result.current.alerts[0]).toMatchObject({ kind: "ready", key: "ready:1" });
  });

  it("avisa cuando una cuenta propia queda por cobrar", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ results: [table(4, "Mesa 4", "occupied", check(31))] }));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestaurantAlerts(), { wrapper });
    await loaded(queryClient);

    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ results: [table(4, "Mesa 4", "to_pay", check(31))] }));
    await poll(queryClient);

    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    expect(result.current.alerts[0]).toMatchObject({ kind: "to_pay", checkId: 31, name: "Mesa 4" });
  });

  it("no avisa por una cuenta que no es de la persona", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ results: [table(4, "Mesa 4", "occupied", check(31, { mine: false }))] }));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestaurantAlerts(), { wrapper });
    await loaded(queryClient);

    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ results: [table(4, "Mesa 4", "to_pay", check(31, { mine: false }))] }));
    await poll(queryClient);

    expect(result.current.alerts).toEqual([]);
  });

  it("avisa cuando otra persona toma una mesa libre", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ results: [table(4, "Mesa 4", "free", null)] }));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestaurantAlerts(), { wrapper });
    await loaded(queryClient);

    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ results: [table(4, "Mesa 4", "occupied", check(31, { mine: false }))] }));
    await poll(queryClient);

    await waitFor(() => expect(result.current.alerts).toHaveLength(1));
    expect(result.current.alerts[0]).toMatchObject({ kind: "table_taken", checkId: 31, name: "Mesa 4" });
  });

  it("no avisa si la mesa la tomó la propia persona", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ results: [table(4, "Mesa 4", "free", null)] }));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestaurantAlerts(), { wrapper });
    await loaded(queryClient);

    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ results: [table(4, "Mesa 4", "occupied", check(31))] }));
    await poll(queryClient);

    expect(result.current.alerts).toEqual([]);
  });

  it("un aviso descartado no vuelve por el mismo evento", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(overview());
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRestaurantAlerts(), { wrapper });
    await loaded(queryClient);

    vi.mocked(restaurantService.overview).mockResolvedValue(overview({ ready_items: [ready(1)] }));
    await poll(queryClient);
    await waitFor(() => expect(result.current.alerts).toHaveLength(1));

    act(() => result.current.dismiss("ready:1"));
    await poll(queryClient);

    expect(result.current.alerts).toEqual([]);
  });
});
