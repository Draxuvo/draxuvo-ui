"use client";
// Módulos del plan que cambian qué bloques muestra el Resumen (FR-006). Mientras la suscripción carga, o si no
// se puede leer (super admin), se muestra todo: la API decide con su 403.
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";

export function useReportModules() {
  const { selectedCompanyId, role } = useAuthStore();
  const { data } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: !!role && role !== "super_admin" && !!selectedCompanyId,
  });
  const has = (module: "work_orders" | "attendance") => !data?.active_modules || data.active_modules.includes(module);
  return { workOrders: has("work_orders"), attendance: has("attendance") };
}
