// src/hooks/use-my-attendance.ts
// Estado de hoy y marcas de entrada y salida de quien tiene la sesión (spec 026).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useModuleGate } from "@/components/subscription/module-locked";
import { attendancesService } from "@/services/attendances";
import { useAuthStore } from "@/store/auth";
import type { MyAttendance } from "@/types";

export function useMyAttendance() {
  const qc = useQueryClient();
  const { selectedCompanyId, role } = useAuthStore();
  const gate = useModuleGate("attendance");
  const key = ["my-attendance", selectedCompanyId] as const;

  // El super admin no es empleado; sin empresa activa no hay a quién marcar.
  const query = useQuery({
    queryKey: key,
    queryFn: attendancesService.today,
    enabled: !!selectedCompanyId && !!role && role !== "super_admin" && gate.enabled,
    retry: false,
  });

  const onSuccess = (data: MyAttendance) => {
    qc.setQueryData(key, data);
    qc.invalidateQueries({ queryKey: ["attendances"] });
  };
  const checkIn = useMutation({ mutationFn: attendancesService.checkIn, onSuccess });
  const checkOut = useMutation({ mutationFn: attendancesService.checkOut, onSuccess });

  // Con error (sin red, módulo fuera del plan) no se afirma ningún estado.
  const data = query.isError ? undefined : query.data;
  return { data, eligible: !!data?.eligible, state: data?.state, checkIn, checkOut, isLoading: query.isLoading };
}
