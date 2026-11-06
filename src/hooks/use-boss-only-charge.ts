"use client";
// ¿La empresa activa tiene «Cobro solo por jefes»? (spec 058) Dueño y administrador lo leen de la suscripción (la misma
// consulta que usan módulos y avisos, siempre al día); el personal no puede leerla y usa la sesión
// (`companies[].boss_only_charge`). Es solo para pintar: quien decide si alguien cobra es la API.
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";

const BILLING_ROLES = new Set(["owner", "admin"]);

export function useBossOnlyCharge(): boolean {
  const role = useAuthStore((s) => s.role);
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const fromSession = useAuthStore((s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.boss_only_charge);
  const canReadSubscription = !!role && BILLING_ROLES.has(role) && !!companyId;

  const { data: subscription } = useQuery({
    queryKey: ["subscription", companyId],
    queryFn: getSubscription,
    retry: false,
    enabled: canReadSubscription,
  });

  if (canReadSubscription && subscription) return !!subscription.boss_only_charge;
  return !!fromSession;
}

/** Dueño o administrador de la empresa activa (el super admin en «Mi empresa» toma el rol de su membresía). */
export function useIsChargeBoss(): boolean {
  const role = useAuthStore((s) => s.role);
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return !!role && BILLING_ROLES.has(role) && companyId != null;
}
