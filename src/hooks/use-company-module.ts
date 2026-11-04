"use client";
// ¿La empresa activa tiene este módulo? (spec 055, H-59) Dueño y administrador lo leen de la suscripción (la misma
// consulta que `useModuleGate`, siempre al día); el personal no puede leerla y usa los módulos que trae la sesión
// (`companies[].modules`, spec 054), que se refrescan al volver a iniciar sesión. Sin dato todavía (la suscripción
// carga o la sesión es anterior a la spec 054) responde `true`: no se quita una función a quien la tiene y, si el
// plan no la incluye, la API la rechaza con 403 `module_not_in_plan`.
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import type { ModuleKey } from "@/types";

const BILLING_ROLES = new Set(["owner", "admin"]);

export function useCompanyModule(module: ModuleKey): boolean {
  const role = useAuthStore((s) => s.role);
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const fromSession = useAuthStore((s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.modules);
  const canReadSubscription = !!role && BILLING_ROLES.has(role) && !!companyId;

  const { data: subscription } = useQuery({
    queryKey: ["subscription", companyId],
    queryFn: getSubscription,
    retry: false,
    enabled: canReadSubscription,
  });

  // La API no le aplica el plan al super admin.
  if (role === "super_admin") return true;
  if (canReadSubscription && subscription) return subscription.active_modules.includes(module);
  if (fromSession) return fromSession.includes(module);
  return true;
}
