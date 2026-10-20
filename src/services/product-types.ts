// src/services/product-types.ts — tipos de producto de la empresa y catálogo de unidades (spec 016).
import { apiClient } from "@/lib/api";
import type { ProductType, ProductTypePayload, UnitRef } from "@/types";

const base = "/api/v1/product_types";

export const productTypesService = {
  list: ({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<ProductType[]> =>
    apiClient.get(base, { params: includeInactive ? { include_inactive: true } : undefined }).then((r) => r.data.results),

  create: (data: ProductTypePayload): Promise<ProductType> =>
    apiClient.post(base, { product_type: data }).then((r) => r.data),

  update: (id: number, data: ProductTypePayload): Promise<ProductType> =>
    apiClient.patch(`${base}/${id}`, { product_type: data }).then((r) => r.data),

  destroy: (id: number): Promise<ProductType> => apiClient.delete(`${base}/${id}`).then((r) => r.data),

  moveProducts: (id: number, toId: number): Promise<{ moved: number }> =>
    apiClient.post(`${base}/${id}/move_products`, { to_id: toId }).then((r) => r.data),

  /** Unidades de medida en una lista plana, ordenadas como las agrupa la API. */
  units: (): Promise<UnitRef[]> =>
    apiClient
      .get("/api/v1/units")
      .then((r) => Object.values(r.data.units as Record<string, UnitRef[]>).flat().map(({ key, name }) => ({ key, name }))),
};
