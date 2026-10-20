// src/hooks/use-product-types.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productTypesService } from "@/services/product-types";
import type { ProductTypePayload } from "@/types";

const KEY = ["product-types"] as const;

/** Activos (para elegir y para las pestañas); con `includeInactive` (admin) también los desactivados. */
export function useProductTypes({ includeInactive = false, enabled = true }: { includeInactive?: boolean; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...KEY, includeInactive ? "all" : "active"],
    queryFn: () => productTypesService.list({ includeInactive }),
    enabled,
  });
}

export function useUnits({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ["units"], queryFn: productTypesService.units, enabled, staleTime: Infinity });
}

function useTypeMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export const useCreateProductType = () => useTypeMutation((data: ProductTypePayload) => productTypesService.create(data));

export const useUpdateProductType = () =>
  useTypeMutation(({ id, data }: { id: number; data: ProductTypePayload }) => productTypesService.update(id, data));

export const useDeleteProductType = () => useTypeMutation((id: number) => productTypesService.destroy(id));

export const useMoveProducts = () =>
  useTypeMutation(({ id, toId }: { id: number; toId: number }) => productTypesService.moveProducts(id, toId));
