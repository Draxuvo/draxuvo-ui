// src/hooks/use-my-attendance.ts
// Estado de hoy y marcas de entrada y salida de quien tiene la sesión (spec 026).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
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
  // Si la API respondió que ya no aplica (otro dispositivo marcó antes), el estado mostrado quedó viejo: se vuelve a pedir.
  // Sin respuesta (sin red) no se toca: pedirlo de nuevo fallaría y ocultaría el acceso.
  const onError = (error: unknown) => {
    if (isAxiosError(error) && error.response) qc.invalidateQueries({ queryKey: key });
  };
  const checkIn = useMutation({ mutationFn: attendancesService.checkIn, onSuccess, onError });
  const checkOut = useMutation({ mutationFn: attendancesService.checkOut, onSuccess, onError });

  // Con error (sin red, módulo fuera del plan) no se afirma ningún estado.
  const data = query.isError ? undefined : query.data;
  return { data, eligible: !!data?.eligible, state: data?.state, checkIn, checkOut, isLoading: query.isLoading };
}
