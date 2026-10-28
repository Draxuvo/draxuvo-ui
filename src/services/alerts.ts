// src/services/alerts.ts — alertas operativas del dueño y el administrador (spec 045).
import { apiClient } from "@/lib/api";
import type {
  AlertSettings,
  AlertSettingsPatch,
  AlertsResponse,
  NotificationPreference,
  OperationalAlert,
  SnoozeMinutes,
  SnoozableAlertKind,
} from "@/types";

const base = "/api/v1";

/** La clave del elemento (lo que sigue a `<kind>:` en el id) es lo que identifica la alerta ante la API. */
export function alertSubjectKey(alert: Pick<OperationalAlert, "id" | "kind">): string {
  return alert.id.slice(alert.kind.length + 1);
}

export const alertsService = {
  /** Se sondea cada 30 s: un fallo no debe llenar la pantalla de avisos, la lista muestra su propio error. */
  list: ({ pageSize = 50 }: { pageSize?: number } = {}): Promise<AlertsResponse> =>
    apiClient.get(`${base}/alerts`, { params: { page_size: pageSize }, skipErrorToast: true }).then((r) => r.data),

  snooze: (data: { kind: SnoozableAlertKind; subject_key: string; minutes: SnoozeMinutes }) =>
    apiClient.post(`${base}/alerts/snooze`, data).then((r) => r.data),

  unsnooze: (kind: SnoozableAlertKind, subjectKey: string) =>
    apiClient.delete(`${base}/alerts/snooze`, { params: { kind, subject_key: subjectKey } }),

  getSettings: (): Promise<AlertSettings> => apiClient.get(`${base}/alert_settings`).then((r) => r.data),

  updateSettings: (data: AlertSettingsPatch): Promise<AlertSettings> =>
    apiClient.patch(`${base}/alert_settings`, data).then((r) => r.data),

  getPreference: (): Promise<NotificationPreference> => apiClient.get(`${base}/notification_preference`).then((r) => r.data),

  updatePreference: (data: Partial<Pick<NotificationPreference, "stock_email" | "stock_whatsapp">>): Promise<NotificationPreference> =>
    apiClient.patch(`${base}/notification_preference`, data).then((r) => r.data),
};
