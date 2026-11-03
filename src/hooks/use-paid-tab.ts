"use client";
// Disponibilidad de la pestaña «Cobradas» (spec 051): depende del módulo `tickets`.
// Dueño y administrador lo saben por la suscripción (`useModuleGate`). El staff no puede leerla: se averigua
// con una consulta mínima a la lista, que responde 403 `module_not_in_plan` si el plan no lo incluye
// (mismo método que `useScreenMode` con el módulo de restaurante).
import { useQuery } from "@tanstack/react-query";
import { useModuleGate } from "@/components/subscription/module-locked";
import { ticketsService } from "@/services/tickets";
import { useAuthStore } from "@/store/auth";

export interface TabAvailability {
  /** La pestaña existe para este rol y plan. */
  available: boolean;
  /** Ya se sabe si existe; mientras no, no se pinta (evita un parpadeo). */
  ready: boolean;
}

export function usePaidTab(): TabAvailability {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const role = useAuthStore((s) => s.role);
  const gate = useModuleGate("tickets");
  const staff = role === "staff";

  const probe = useQuery({
    queryKey: ["tickets", "probe", companyId],
    queryFn: () => ticketsService.list({ page: 1, page_size: 1 }),
    enabled: staff && !!companyId,
    retry: false,
    staleTime: 60_000,
  });

  if (!staff) {
    const locked = gate.isLocked();
    return { available: gate.enabled, ready: gate.enabled || locked };
  }
  const ready = probe.isSuccess || probe.isError;
  return { available: ready && !gate.isLocked(probe.error), ready };
}
