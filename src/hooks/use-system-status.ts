// src/hooks/use-system-status.ts — estado del sistema (spec 073). Se relee cada minuto solo con la pestaña a la vista.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { systemStatusService } from "@/services/system-status";

export const SYSTEM_STATUS_KEY = ["system-status"] as const;

export function useSystemStatus({ enabled = true }: { enabled?: boolean } = {}) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const query = useQuery({
    queryKey: SYSTEM_STATUS_KEY,
    queryFn: () => systemStatusService.get(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    enabled,
  });

  /** Botón «Actualizar»: relee lo interno; lo externo respeta su copia de 1 minuto en la API. */
  async function refresh() {
    setRefreshing(true);
    try {
      qc.setQueryData(SYSTEM_STATUS_KEY, await systemStatusService.get(true));
    } finally {
      setRefreshing(false);
    }
  }

  return { ...query, refresh, refreshing };
}
