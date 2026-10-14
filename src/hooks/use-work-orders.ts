/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/use-work-orders.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { ListParams, PaginatedResponse, WorkOrder, WorkOrderFilters } from "@/types";

export type WorkOrderListParams = WorkOrderFilters & ListParams;

export function listWorkOrders({
  page = 1,
  page_size = 20,
  status,
  priority,
  employee_id,
  search,
}: WorkOrderListParams = {}): Promise<PaginatedResponse<WorkOrder>> {
  return apiClient
    .get("/api/v1/work_orders", {
      params: { page, page_size, status, priority, employee_id, search: search?.trim() || undefined },
    })
    .then((r) => r.data);
}

/**
 * Lista paginada de órdenes. Query key `["work-orders", filters, page]` (contracts/ui-routes.md);
 * las invalidaciones por prefijo `["work-orders"]` siguen aplicando.
 */
export function useWorkOrders(filters: WorkOrderFilters = {}, { page = 1, page_size = 20 }: ListParams = {}) {
  return useQuery<PaginatedResponse<WorkOrder>>({
    queryKey: ["work-orders", filters, page, page_size],
    queryFn: () => listWorkOrders({ ...filters, page, page_size }),
  });
}

export function useWorkOrder(id: number) {
  return useQuery<WorkOrder>({
    queryKey: ["work-orders", id],
    queryFn: () =>
      apiClient.get(`/api/v1/work_orders/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiClient.post("/api/v1/work_orders", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-orders"] }),
  });
}

export function useUpdateWorkOrder(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiClient.put(`/api/v1/work_orders/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-orders"] }),
  });
}

export function useUpdateStatus(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      apiClient
        .patch(`/api/v1/work_orders/${id}/update_status`, { status })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: ["work-orders", id] });
    },
  });
}

export function useToggleItem(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) =>
      apiClient
        .patch(`/api/v1/work_orders/${orderId}/items/${itemId}/toggle`, {})
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["work-orders", orderId], data);
      qc.invalidateQueries({ queryKey: ["work-orders"] });
    },
  });
}

export function useAddItem(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiClient
        .post(`/api/v1/work_orders/${orderId}/items`, data)
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["work-orders", orderId], data);
      qc.invalidateQueries({ queryKey: ["work-orders"] });
    },
  });
}

export function useUpdateItem(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: any }) =>
      apiClient
        .patch(`/api/v1/work_orders/${orderId}/items/${itemId}`, data)
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["work-orders", orderId], data);
      qc.invalidateQueries({ queryKey: ["work-orders"] });
    },
  });
}

export function useDeleteItem(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) =>
      apiClient
        .delete(`/api/v1/work_orders/${orderId}/items/${itemId}`)
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["work-orders", orderId], data);
      qc.invalidateQueries({ queryKey: ["work-orders"] });
    },
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/api/v1/work_orders/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-orders"] }),
  });
}
