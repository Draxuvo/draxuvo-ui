import { apiClient } from "@/lib/api";
import type { PlansResponse } from "@/types";

// Pública: no requiere sesión ni X-Company-Id.
export const getPlans = (): Promise<PlansResponse> =>
  apiClient.get("/api/v1/plans").then((r) => r.data);

export const plansService = {
  list: getPlans,
};
