// src/hooks/use-restaurant.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  restaurantService,
  type StationPayload,
  type TablePayload,
} from "@/services/restaurant";
import type { StationBoard } from "@/types";

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
