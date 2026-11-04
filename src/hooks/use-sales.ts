// src/hooks/use-sales.ts — estado de servidor de la venta de mostrador (spec 050).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { salesService, type AddItemInput, type SalesListParams } from "@/services/sales";
import { useModuleGate } from "@/components/subscription/module-locked";
import { useCompanyModule } from "@/hooks/use-company-module";
import type { ChargePaymentInput, Sale } from "@/types";

const KEY = ["sales"] as const;
const saleKey = (id: number) => [...KEY, "detail", id] as const;

export function useSales(params: SalesListParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...KEY, "list", params],
    queryFn: () => salesService.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Las ventas abiertas del usuario (la lista ya viene recortada por rol en la API). */
export function useOpenSales(enabled = true) {
  const gate = useModuleGate("pos");
  const available = useCompanyModule("pos");
  return useSales({ status: "open", page_size: 50 }, enabled && gate.enabled && available);
}

export function useSale(id: number | null) {
  // Cada cambio de la venta devuelve la venta completa y la deja en caché: con `staleTime` la consulta de detalle no
  // vuelve a pedirla justo después de abrirla y no pisa con datos viejos un artículo recién agregado.
  return useQuery({ queryKey: saleKey(id ?? 0), queryFn: () => salesService.get(id as number), enabled: id !== null, staleTime: 30_000 });
}

export function useSalesCatalog(search: string, enabled = true) {
  // Spec 055 (H-56): sin el módulo del plan no se pide el catálogo (daba un 403 en consola antes del aviso de módulo).
  const gate = useModuleGate("pos");
  const available = useCompanyModule("pos");
  enabled = enabled && gate.enabled && available;
  return useQuery({
    queryKey: [...KEY, "catalog", search],
    queryFn: () => salesService.catalog({ search }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useSaleMutation<T>(fn: (input: T) => Promise<Sale>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (sale) => {
      qc.setQueryData(saleKey(sale.id), sale);
      qc.invalidateQueries({ queryKey: [...KEY, "list"] });
      // Cancelar devuelve existencias: el inventario se vuelve a pedir.
      if (sale.status === "cancelled") qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export const useCreateSale = () => useSaleMutation<void>(() => salesService.create());

export const useAddSaleItem = () => useSaleMutation(({ saleId, input }: { saleId: number; input: AddItemInput }) => salesService.addItem(saleId, input));

export const useUpdateSaleItem = () =>
  useSaleMutation(({ saleId, itemId, quantity }: { saleId: number; itemId: number; quantity: number }) =>
    salesService.updateItem(saleId, itemId, quantity),
  );

export const useRemoveSaleItem = () => useSaleMutation(({ saleId, itemId }: { saleId: number; itemId: number }) => salesService.removeItem(saleId, itemId));

export const useCancelSale = () => useSaleMutation(({ saleId, reason }: { saleId: number; reason: string }) => salesService.cancel(saleId, reason));

export function useDiscardSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => salesService.discard(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: saleKey(id) });
      qc.invalidateQueries({ queryKey: [...KEY, "list"] });
    },
  });
}

export function useChargeSale(saleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lockVersion, payments, idempotencyKey }: { lockVersion: number; payments: ChargePaymentInput[]; idempotencyKey: string }) =>
      salesService.charge(saleId, { lock_version: lockVersion, payments }, idempotencyKey),
    onSuccess: (result) => {
      qc.setQueryData(saleKey(saleId), result.sale);
      // Cobrar mueve existencias: el inventario y el catálogo de la caja se vuelven a pedir.
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
