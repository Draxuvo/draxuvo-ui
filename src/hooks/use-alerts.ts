// src/hooks/use-alerts.ts — alertas operativas (spec 045). No es lo mismo que use-restaurant-alerts.ts (sonidos de comanda, spec 043).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertsService } from "@/services/alerts";
import { useAuthStore } from "@/store/auth";
import type { AlertSettingsPatch, NotificationPreference, SnoozeMinutes, SnoozableAlertKind } from "@/types";

/** Las alertas se sondean cada 30 s (research R8): aparecen y se van en menos de 1 minuto. */
export const ALERTS_POLL_MS = 30_000;

const KEY = ["alerts"] as const;
const BOSS_ROLES = new Set(["owner", "admin"]);

/**
 * Solo dueño y administrador de la empresa activa ven alertas (el super admin las ve al entrar a una empresa: su rol
 * pasa a ser el de su membresía). La API también lo exige con 403.
 */
export function useCanSeeAlerts(): boolean {
  const role = useAuthStore((s) => s.role);
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return !!role && BOSS_ROLES.has(role) && companyId != null;
}

export function useAlerts({ pageSize = 50, enabled = true }: { pageSize?: number; enabled?: boolean } = {}) {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const allowed = useCanSeeAlerts();
  return useQuery({
    queryKey: [...KEY, companyId, pageSize],
    queryFn: () => alertsService.list({ pageSize }),
    enabled: enabled && allowed,
    refetchInterval: ALERTS_POLL_MS,
    staleTime: ALERTS_POLL_MS / 2,
  });
}

export function useSnoozeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { kind: SnoozableAlertKind; subject_key: string; minutes: SnoozeMinutes }) => alertsService.snooze(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUnsnoozeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, subjectKey }: { kind: SnoozableAlertKind; subjectKey: string }) => alertsService.unsnooze(kind, subjectKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAlertSettings({ enabled = true }: { enabled?: boolean } = {}) {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({ queryKey: ["alert-settings", companyId], queryFn: alertsService.getSettings, enabled });
}

export function useUpdateAlertSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AlertSettingsPatch) => alertsService.updateSettings(data),
    onSuccess: (settings) => {
      const companyId = useAuthStore.getState().selectedCompanyId;
      qc.setQueryData(["alert-settings", companyId], settings);
      // El nuevo límite cambia qué alertas hay: se vuelven a pedir ya, sin esperar al sondeo.
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useNotificationPreference({ enabled = true }: { enabled?: boolean } = {}) {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({ queryKey: ["notification-preference", companyId], queryFn: alertsService.getPreference, enabled });
}

export function useUpdateNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NotificationPreference>) => alertsService.updatePreference(data),
    onSuccess: (preference) => {
      const companyId = useAuthStore.getState().selectedCompanyId;
      qc.setQueryData(["notification-preference", companyId], preference);
    },
  });
}
