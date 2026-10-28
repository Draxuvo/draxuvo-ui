// src/services/whatsapp.ts — configurar WhatsApp desde el panel (spec 047). Solo super admin; la llave nunca vuelve completa.
// Los errores los muestra cada pantalla (`skipErrorToast`): traen un motivo que se traduce en `whatsapp.reasons`.
import { apiClient } from "@/lib/api";
import type { PaginatedResponse, WhatsappEvent, WhatsappGuideItem, WhatsappKind, WhatsappState } from "@/types";

const base = "/api/v1/whatsapp";

export interface ConnectionPayload {
  /** Opcional si ya hay una llave guardada y no cambia. */
  access_token?: string;
  phone_number_id?: string;
  waba_id?: string;
  lock_version?: number;
}

export interface MessageTypePayload {
  template_name?: string;
  template_language?: string;
  lock_version?: number;
}

export const whatsappService = {
  state: (): Promise<WhatsappState> => apiClient.get(base).then((r) => r.data),

  guide: (): Promise<WhatsappGuideItem[]> => apiClient.get(`${base}/guide`).then((r) => r.data.results),

  events: (params: { page?: number; page_size?: number } = {}): Promise<PaginatedResponse<WhatsappEvent>> =>
    apiClient.get(`${base}/events`, { params }).then((r) => r.data),

  saveConnection: (payload: ConnectionPayload): Promise<WhatsappState> =>
    apiClient.put(`${base}/connection`, payload, { skipErrorToast: true }).then((r) => r.data),

  verifyConnection: (): Promise<WhatsappState> =>
    apiClient.post(`${base}/connection/verify`, {}, { skipErrorToast: true }).then((r) => r.data),

  updateMessageType: (kind: WhatsappKind, payload: MessageTypePayload): Promise<WhatsappState> =>
    apiClient.patch(`${base}/message_types/${kind}`, payload, { skipErrorToast: true }).then((r) => r.data),

  verifyMessageType: (kind: WhatsappKind): Promise<WhatsappState> =>
    apiClient.post(`${base}/message_types/${kind}/verify`, {}, { skipErrorToast: true }).then((r) => r.data),

  disconnect: (payload: { confirm?: boolean; lock_version?: number }): Promise<WhatsappState> =>
    apiClient.delete(`${base}/connection`, { data: payload, skipErrorToast: true }).then((r) => r.data),
};
