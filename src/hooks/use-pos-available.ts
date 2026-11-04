"use client";
// ¿La empresa activa tiene el punto de venta? (spec 050) El personal (staff) no puede leer la suscripción. Desde la
// spec 054 la sesión trae los módulos activos de cada empresa (`companies[].modules`) y se lee de ahí, sin pedir nada.
// Solo una sesión guardada antes de ese cambio, sin `modules`, cae al sondeo de antes: pedir una venta y entender el 403
// `module_not_in_plan` como "no hay módulo" (la sesión se refresca sola al volver a entrar).
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { expectModuleLock } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { salesService } from "@/services/sales";

export function usePosAvailable(): boolean {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const known = useAuthStore((s) => s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.modules);
  useEffect(() => expectModuleLock("pos"), []);
  const probe = useQuery({
    queryKey: ["sales", "probe", companyId],
    queryFn: () => salesService.list({ page_size: 1 }).then(() => true),
    enabled: !!companyId && known === undefined,
    retry: false,
    staleTime: 60_000,
  });
  return known ? known.includes("pos") : probe.isSuccess;
}
