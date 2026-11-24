// src/services/system-status.ts — estado del sistema (spec 073). Solo super admin.
import { apiClient } from "@/lib/api";
import type { SystemStatus } from "@/types";

export const systemStatusService = {
  get: (refresh = false): Promise<SystemStatus> =>
    apiClient.get("/api/v1/system_status", { params: refresh ? { refresh: 1 } : {} }).then((r) => r.data),
};
