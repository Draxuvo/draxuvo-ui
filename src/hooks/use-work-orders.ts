/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/use-work-orders.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type {
  ChargePaymentInput,
  ListParams,
  OrderMode,
  PaginatedResponse,
  PaymentMethod,
  WorkOrder,
  WorkOrderFilters,
  WorkOrderSummary,
} from "@/types";

export type WorkOrderListParams = WorkOrderFilters & ListParams;

export function listWorkOrders({
  page = 1,
  page_size = 20,
  status,
  priority,
  employee_id,
  search,
  unassigned,
  paid_on,
  sort_by,
}: WorkOrderListParams = {}): Promise<PaginatedResponse<WorkOrder>> {
  return apiClient
    .get("/api/v1/work_orders", {
      params: {
        page,
        page_size,
        status,
        priority,
        employee_id,
        search: search?.trim() || undefined,
        unassigned: unassigned || undefined,
        paid_on,
        sort_by,
      },
    })
    .then((r) => r.data);
}

/**
 * Lista paginada de órdenes. Query key `["work-orders", filters, page]` (contracts/ui-routes.md);
 * las invalidaciones por prefijo `["work-orders"]` siguen aplicando. `enabled: false` cuando el
 * módulo está fuera del plan (`useModuleGate`): sin request ni toast.
 */
export function useWorkOrders(
  filters: WorkOrderFilters = {},
  { page = 1, page_size = 20 }: ListParams = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery<PaginatedResponse<WorkOrder>>({
    queryKey: ["work-orders", filters, page, page_size],
    queryFn: () => listWorkOrders({ ...filters, page, page_size }),
    enabled,
  });
}

export function useWorkOrder(id: number) {
  return useQuery<WorkOrder>({
    queryKey: ["work-orders", id],
    queryFn: () => apiClient.get(`/api/v1/work_orders/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

/** Conteos de los grupos de `/ordenes` y `/mis-ordenes`. Key `["work-orders", "summary"]`. */
export function useWorkOrderSummary({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<WorkOrderSummary>({
    queryKey: ["work-orders", "summary"],
    queryFn: () => apiClient.get("/api/v1/work_orders/summary").then((r) => r.data),
    enabled,
  });
}

/** Refresca listas, tickets y dashboard tras una mutación de orden. */
function useRefreshOrders() {
  const qc = useQueryClient();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return {
    qc,
    /** `setQueryData` del detalle (si hay respuesta) e invalidación por prefijo. */
    after(id: number | undefined, data: WorkOrder | undefined, opts: { tickets?: boolean; dashboard?: boolean } = {}) {
      if (id && data) qc.setQueryData(["work-orders", id], data);
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      if (opts.tickets) qc.invalidateQueries({ queryKey: ["tickets"] });
      if (opts.dashboard) qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
    },
  };
}

export function useCreateWorkOrder() {
  const { after } = useRefreshOrders();
  return useMutation({
    mutationFn: (data: any) => apiClient.post("/api/v1/work_orders", data).then((r) => r.data as WorkOrder),
    onSuccess: (data) => after(data?.id, data, { dashboard: true }),
  });
}

export function useUpdateWorkOrder(id: number) {
  const { after } = useRefreshOrders();
  return useMutation({
    mutationFn: (data: any) => apiClient.put(`/api/v1/work_orders/${id}`, data).then((r) => r.data as WorkOrder),
    onSuccess: (data) => after(id, data, { dashboard: true }),
  });
}

export function useDeleteWorkOrder() {
  const { qc, after } = useRefreshOrders();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/v1/work_orders/${id}`).then((r) => r.data),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: ["work-orders", id], exact: true });
      after(undefined, undefined, { dashboard: true });
    },
  });
}

/** Transición de estado: `POST /work_orders/:id/<action>`. */
function useTransition(id: number, action: string, opts: { tickets?: boolean } = {}) {
  const { after } = useRefreshOrders();
  return useMutation({
    mutationFn: (body?: Record<string, unknown>) =>
      apiClient.post(`/api/v1/work_orders/${id}/${action}`, body ?? {}).then((r) => r.data as WorkOrder),
    onSuccess: (data) => after(id, data, { dashboard: true, tickets: opts.tickets }),
  });
}

export const useStartOrder = (id: number) => useTransition(id, "start");
export const useFinishOrder = (id: number) => useTransition(id, "finish");
export const useReopenOrder = (id: number) => useTransition(id, "reopen");
export const useCancelOrder = (id: number) => useTransition(id, "cancel");

export type ChargePayload = {
  payment_method: PaymentMethod;
  amount_received?: number;
};

/**
 * Cobro con uno o varios pagos (spec 015). La misma `Idempotency-Key` en un reintento no cobra dos veces.
 */
export function useChargeOrder(id: number) {
  const { after } = useRefreshOrders();
  return useMutation({
    mutationFn: ({ payments, idempotencyKey }: { payments: ChargePaymentInput[]; idempotencyKey: string }) =>
      apiClient
        .post(`/api/v1/work_orders/${id}/charge`, { payments }, { headers: { "Idempotency-Key": idempotencyKey } })
        .then((r) => r.data as WorkOrder),
    onSuccess: (data) => after(id, data, { dashboard: true, tickets: true }),
  });
}

export const useVoidCharge = (id: number) => useTransition(id, "void_charge", { tickets: true });

// Conceptos
function useOrderMutation<V>(orderId: number, fn: (v: V) => Promise<WorkOrder>) {
  const { after } = useRefreshOrders();
  return useMutation({ mutationFn: fn, onSuccess: (data) => after(orderId, data, { dashboard: true }) });
}

export function useAddItem(orderId: number) {
  return useOrderMutation(orderId, (data: any) =>
    apiClient.post(`/api/v1/work_orders/${orderId}/items`, data).then((r) => r.data),
  );
}

export function useUpdateItem(orderId: number) {
  return useOrderMutation(orderId, ({ itemId, data }: { itemId: number; data: any }) =>
    apiClient.patch(`/api/v1/work_orders/${orderId}/items/${itemId}`, data).then((r) => r.data),
  );
}

export function useDeleteItem(orderId: number) {
  return useOrderMutation(orderId, (itemId: number) =>
    apiClient.delete(`/api/v1/work_orders/${orderId}/items/${itemId}`).then((r) => r.data),
  );
}

// Pasos
export function useAddStep(orderId: number) {
  return useOrderMutation(orderId, (data: { description: string; position?: number }) =>
    apiClient.post(`/api/v1/work_orders/${orderId}/steps`, data).then((r) => r.data),
  );
}

/** `{ done }` marca o desmarca; `{ description, position }` edita (solo jefe). */
export function useUpdateStep(orderId: number) {
  return useOrderMutation(
    orderId,
    ({ stepId, data }: { stepId: number; data: { done?: boolean; description?: string; position?: number } }) =>
      apiClient.patch(`/api/v1/work_orders/${orderId}/steps/${stepId}`, data).then((r) => r.data),
  );
}

export function useDeleteStep(orderId: number) {
  return useOrderMutation(orderId, (stepId: number) =>
    apiClient.delete(`/api/v1/work_orders/${orderId}/steps/${stepId}`).then((r) => r.data),
  );
}

// Notas y fotos
export function useAddNote(orderId: number) {
  return useOrderMutation(orderId, (text: string) =>
    apiClient.post(`/api/v1/work_orders/${orderId}/notes`, { text }).then((r) => r.data),
  );
}

export function useUploadPhoto(orderId: number) {
  return useOrderMutation(orderId, ({ file, description }: { file: File; description?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (description) form.append("description", description);
    return apiClient
      .post(`/api/v1/work_orders/${orderId}/photos`, form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  });
}

export function useDeletePhoto(orderId: number) {
  return useOrderMutation(orderId, (photoId: number) =>
    apiClient.delete(`/api/v1/work_orders/${orderId}/photos/${photoId}`).then((r) => r.data),
  );
}

/** Modo de órdenes de la empresa activa (solo owner). Actualiza `user.companies[].order_mode`. */
export function useUpdateOrderMode() {
  return useMutation({
    mutationFn: (order_mode: OrderMode) =>
      apiClient.patch("/api/v1/company/order_mode", { order_mode }).then((r) => r.data as { order_mode: OrderMode }),
    onSuccess: async ({ order_mode }) => {
      const { user, selectedCompanyId, setUser, fetchMe } = useAuthStore.getState();
      if (user?.companies) {
        setUser({
          ...user,
          companies: user.companies.map((c) => (c.id === selectedCompanyId ? { ...c, order_mode } : c)),
        });
      }
      await fetchMe().catch(() => {});
    },
  });
}
