// src/services/demo.ts
import { apiClient } from "@/lib/api";
import type {
  DemoEndedReason,
  DemoInvite,
  DemoInvitePayload,
  DemoInviteResolution,
  DemoInviteStatus,
  DemoPlan,
  DemoSession,
  DemoSessionPayload,
  DemoSessionResponse,
  PaginatedResponse,
} from "@/types";

const base = "/api/v1";

export interface DemoInviteListParams {
  page?: number;
  page_size?: number;
  status?: DemoInviteStatus;
  plan?: DemoPlan;
  search?: string;
}

export interface DemoSessionListParams {
  page?: number;
  page_size?: number;
  plan?: DemoPlan;
  demo_invite_id?: number;
  with_contact?: boolean;
  from?: string;
  to?: string;
  search?: string;
}

export const demoService = {
  /** Abre una demo nueva (público): crea la empresa de demostración y devuelve la sesión ya iniciada. */
  open: (payload: DemoSessionPayload): Promise<DemoSessionResponse> =>
    apiClient.post(`${base}/demo_sessions`, payload, { skipErrorToast: true }).then((r) => r.data),

  /** Qué plan abre una invitación, sin crear nada. */
  resolveInvite: (token: string): Promise<DemoInviteResolution> =>
    apiClient.get(`${base}/demo_invites/resolve`, { params: { token }, skipErrorToast: true }).then((r) => r.data),

  /** «Salir de la demo» o «Crear mi cuenta»: termina la demo y encola su borrado. */
  finish: (reason: Exclude<DemoEndedReason, "expired">): Promise<void> =>
    apiClient.delete(`${base}/demo_sessions/current`, { data: { reason }, skipErrorToast: true }).then(() => undefined),

  // Solo super admin
  listInvites: (params: DemoInviteListParams = {}): Promise<PaginatedResponse<DemoInvite>> =>
    apiClient.get(`${base}/demo_invites`, { params }).then((r) => r.data),

  createInvite: (payload: DemoInvitePayload): Promise<DemoInvite> =>
    apiClient.post(`${base}/demo_invites`, payload).then((r) => r.data),

  revokeInvite: (id: number): Promise<DemoInvite> =>
    apiClient.post(`${base}/demo_invites/${id}/revoke`).then((r) => r.data),

  listSessions: (params: DemoSessionListParams = {}): Promise<PaginatedResponse<DemoSession>> =>
    apiClient.get(`${base}/demo_sessions`, { params }).then((r) => r.data),
};
