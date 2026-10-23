// src/hooks/use-stock-count.ts
// Conteo físico en borrador (spec 034): lista de borradores, el conteo abierto y sus acciones. Cada escaneo o
// cambio de cantidad se guarda en el servidor, así se retoma desde cualquier equipo.
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "@/services/inventory";
import { useAuthStore } from "@/store/auth";
import type { StockCount } from "@/types";

export const COUNT_POLL_MS = 5000;

export function useStockCounts(enabled = true) {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["stock-counts", companyId, "draft"],
    queryFn: () => inventoryService.counts.list("draft").then((r) => r.results),
    enabled,
  });
}

export function useStockCount(id: number | null) {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["stock-counts", companyId, id],
    queryFn: () => inventoryService.counts.get(id as number),
    enabled: id !== null,
    // Otra persona puede estar contando el mismo borrador: se refresca mientras está a la vista.
    refetchInterval: (query) => (query.state.data?.status === "draft" ? COUNT_POLL_MS : false),
    refetchIntervalInBackground: false,
  });
}

export function useStockCountActions(id: number | null) {
  const qc = useQueryClient();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const keep = (count: StockCount) => qc.setQueryData(["stock-counts", companyId, count.id], count);
  const refreshLists = () => qc.invalidateQueries({ queryKey: ["stock-counts", companyId, "draft"] });

  return {
    create: useMutation({
      mutationFn: (name?: string) => inventoryService.counts.create(name),
      onSuccess: (count) => {
        keep(count);
        void refreshLists();
      },
    }),
    scan: useMutation({
      mutationFn: ({ code, qty = 1 }: { code: string; qty?: number }) => inventoryService.counts.scan(id as number, code, qty),
      onSuccess: (count) => count && keep(count),
    }),
    setItem: useMutation({
      mutationFn: ({ productId, qty }: { productId: number; qty: number }) => inventoryService.counts.setItem(id as number, productId, qty),
      onSuccess: keep,
    }),
    removeItem: useMutation({
      mutationFn: (productId: number) => inventoryService.counts.removeItem(id as number, productId),
      onSuccess: keep,
    }),
    confirm: useMutation({
      mutationFn: () => inventoryService.counts.confirm(id as number),
      onSuccess: (result) => {
        keep(result.count);
        void refreshLists();
        void qc.invalidateQueries({ queryKey: ["products"] });
      },
    }),
    discard: useMutation({
      mutationFn: () => inventoryService.counts.discard(id as number),
      onSuccess: () => void refreshLists(),
    }),
  };
}
