"use client";
// Modo de la pantalla según la empresa activa (spec 018, R2). El panel no siempre puede leer la suscripción
// (staff no puede), así que el módulo de restaurante se averigua pidiendo el plano de mesas: responde 403
// `module_not_in_plan` cuando el plan no lo incluye. Un restaurante sin ninguna mesa dada de alta no cuenta:
// los planes Pro y Empresa traen el módulo aunque el negocio no sea un restaurante.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { expectModuleLock } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { restaurantService } from "@/services/restaurant";
import { screenMode, type ScreenMode } from "./lib";

export function useScreenMode(): { mode: ScreenMode; ready: boolean } {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const role = useAuthStore((s) => s.role);
  const orderMode = useAuthStore((s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.order_mode);
  // El 403 `module_not_in_plan` de una empresa sin restaurante es la respuesta esperada, no un error que avisar.
  useEffect(() => expectModuleLock("restaurant"), []);
  const probe = useQuery({
    queryKey: ["restaurant", "probe", companyId],
    queryFn: () => restaurantService.overview().then((r) => r.results.some((table) => table.active)),
    enabled: !!companyId && role !== "super_admin",
    retry: false,
    staleTime: 60_000,
  });
  // Sin empresa activa aún (la sesión se está recuperando) todavía no se sabe el modo.
  const ready = role === "super_admin" || (!!companyId && (probe.isSuccess || probe.isError));
  return { mode: screenMode(probe.data ? ["restaurant"] : [], orderMode), ready };
}
