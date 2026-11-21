// src/services/terminal-charges.ts — solicitudes de cobro en terminales integradas (spec 069, contracts/api.md).
import { apiClient } from "@/lib/api";
import type { PaginatedResponse, TerminalCharge, TerminalChargeOwnerType } from "@/types";

const base = "/api/v1/terminal_charges";

export interface TerminalChargeInput {
  terminal_id: number;
  amount: number;
  owner: { type: TerminalChargeOwnerType; id: number };
  /** Lo demás del cobro de siempre: otros pagos, `lock_version` (venta), `confirm_incomplete` (cuenta). */
  params?: Record<string, unknown>;
}

export const terminalChargesService = {
  /** La pantalla muestra los errores por su cuenta (terminal ocupada, rechazo, etc.). */
  create: ({ terminal_id, amount, owner, params = {} }: TerminalChargeInput): Promise<TerminalCharge> =>
    apiClient
      .post(base, { terminal_id, amount, [`${owner.type}_id`]: owner.id, params }, { skipErrorToast: true })
      .then((r) => r.data),

  get: (id: number): Promise<TerminalCharge> => apiClient.get(`${base}/${id}`).then((r) => r.data),

  cancel: (id: number): Promise<TerminalCharge> => apiClient.post(`${base}/${id}/cancel`, null, { skipErrorToast: true }).then((r) => r.data),

  abandon: (id: number): Promise<TerminalCharge> => apiClient.post(`${base}/${id}/abandon`).then((r) => r.data),

  list: (params: { status?: string; page?: number; search?: string } = {}): Promise<PaginatedResponse<TerminalCharge>> =>
    apiClient.get(base, { params }).then((r) => r.data),

  /** Reembolsa un pago sin aplicar (FR-035); la lista muestra el motivo si el proveedor no lo acepta. */
  refund: (id: number): Promise<TerminalCharge> =>
    apiClient.post(`${base}/${id}/refund`, { confirm: true }, { skipErrorToast: true }).then((r) => r.data),

  /** Lo marca atendido fuera de Draxuvo (por ejemplo, se devolvió desde Mercado Pago). */
  dismiss: (id: number): Promise<TerminalCharge> => apiClient.post(`${base}/${id}/dismiss`).then((r) => r.data),
};
