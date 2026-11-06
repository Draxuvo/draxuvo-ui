// src/services/charge-queue.ts — cola «Por cobrar» (spec 058, contracts/api.md): solo jefes.
import { apiClient } from "@/lib/api";
import type { ChargeQueue } from "@/types";

export const chargeQueueService = {
  get: () => apiClient.get<ChargeQueue>("/api/v1/charge_queue", { skipErrorToast: true }).then((r) => r.data),
};
