// src/hooks/use-restaurant.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  restaurantService,
  type StationPayload,
  type TablePayload,
} from "@/services/restaurant";
import { inventoryService } from "@/services/inventory";
import { useAuthStore } from "@/store/auth";
import type { Check, StationBoard } from "@/types";

/** La estación sondea cada 3 s (research R2); se pausa con la pestaña oculta. */
export const BOARD_POLL_MS = 3000;

export function useStations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["restaurant", "stations"],
    queryFn: restaurantService.stations,
    enabled,
  });
}

export function useRestaurantTables({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["restaurant", "tables"],
    queryFn: restaurantService.tables,
    enabled,
  });
}

export function useStockAlerts({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["restaurant", "stock-alerts"],
    queryFn: restaurantService.stockAlerts,
    enabled,
    refetchInterval: 30_000,
  });
}

/** Diferencia entre el reloj del servidor y el de la tablet, para que los minutos no dependan de una hora mal puesta. */
function withClockOffset(board: StationBoard): StationBoard & { offset: number } {
  return { ...board, offset: new Date(board.server_time).getTime() - Date.now() };
}

export function useStationBoard(stationId: number) {
  return useQuery({
    queryKey: ["restaurant", "board", stationId],
    queryFn: () => restaurantService.board(stationId),
    select: withClockOffset,
    enabled: !!stationId,
    refetchInterval: BOARD_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    // Una falla de red no vacía el tablero: se conserva lo último que se vio.
    retry: false,
  });
}

export function useAdvance(stationId: number) {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["restaurant", "board", stationId] });
  const item = useMutation({
    mutationFn: (itemId: number) => restaurantService.advanceItem(stationId, itemId),
    onSettled: refresh,
  });
  const order = useMutation({
    mutationFn: (kitchenOrderId: number) =>
      restaurantService.advanceOrder(stationId, kitchenOrderId),
    onSettled: refresh,
  });
  return { item, order };
}

export function useStationMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["restaurant", "stations"] });
  return {
    create: useMutation({
      mutationFn: (data: StationPayload) => restaurantService.createStation(data),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<StationPayload> }) =>
        restaurantService.updateStation(id, data),
      onSuccess: refresh,
    }),
  };
}

export function useTableMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["restaurant", "tables"] });
  return {
    create: useMutation({
      mutationFn: (data: TablePayload) => restaurantService.createTable(data),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<TablePayload> }) =>
        restaurantService.updateTable(id, data),
      onSuccess: refresh,
    }),
  };
}

/** El plano y la cuenta abierta se consultan cada 4 s con la pestaña visible (spec 018, R6). */
export const PEDIDO_POLL_MS = 4000;

export function useTablesOverview({ enabled = true }: { enabled?: boolean } = {}) {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["restaurant", "overview", companyId],
    queryFn: restaurantService.overview,
    enabled,
    retry: false,
    refetchInterval: PEDIDO_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useCheck(id: number | null) {
  return useQuery({
    queryKey: ["restaurant", "check", id],
    queryFn: () => restaurantService.getCheck(id as number),
    enabled: !!id,
    refetchInterval: PEDIDO_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useSaleMenu({ enabled = true }: { enabled?: boolean } = {}) {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["restaurant", "menu", companyId],
    queryFn: () => inventoryService.menu().then((r) => r.menu),
    enabled,
    staleTime: 15_000,
  });
}

/** Deja en caché la cuenta que devolvió la API y marca el plano y el menú para recargar. */
export function useApplyCheck() {
  const client = useQueryClient();
  return (check: Check) => {
    client.setQueryData(["restaurant", "check", check.id], check);
    void client.invalidateQueries({ queryKey: ["restaurant", "overview"] });
    void client.invalidateQueries({ queryKey: ["restaurant", "menu"] });
  };
}

export function useOpenCheck() {
  const apply = useApplyCheck();
  return useMutation({
    mutationFn: (body: { dining_table_id: number } | { takeout_name: string }) => restaurantService.openCheck(body),
    onSuccess: apply,
  });
}

export function useCheckActions(checkId: number) {
  const apply = useApplyCheck();
  return {
    add: useMutation({
      mutationFn: (body: { product_id: number; quantity: number; note?: string }) =>
        restaurantService.addCheckItem(checkId, body),
      onSuccess: apply,
    }),
    update: useMutation({
      mutationFn: ({ itemId, ...body }: { itemId: number; quantity?: number; note?: string }) =>
        restaurantService.updateCheckItem(checkId, itemId, body),
      onSuccess: apply,
    }),
    remove: useMutation({
      mutationFn: (itemId: number) => restaurantService.removeCheckItem(checkId, itemId),
      onSuccess: apply,
    }),
    send: useMutation({
      mutationFn: (idempotencyKey: string) => restaurantService.sendRound(checkId, idempotencyKey),
      onSuccess: (res) => apply(res.check),
    }),
  };
}
