"use client";
// ¿La empresa activa tiene el punto de venta? (spec 050) El personal (staff) no puede leer la suscripción, así que se
// averigua pidiendo una venta: la API responde 403 `module_not_in_plan` cuando el módulo no está. Ese 403 es la
// respuesta esperada de una empresa sin el módulo, no un error que avisar.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { expectModuleLock } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { salesService } from "@/services/sales";

export function usePosAvailable(): boolean {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  useEffect(() => expectModuleLock("pos"), []);
  const probe = useQuery({
    queryKey: ["sales", "probe", companyId],
    queryFn: () => salesService.list({ page_size: 1 }).then(() => true),
    enabled: !!companyId,
    retry: false,
    staleTime: 60_000,
  });
  return probe.isSuccess;
}
