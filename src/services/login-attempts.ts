// src/services/login-attempts.ts — bitácora de inicios de sesión (spec 073). Solo super admin.
import { apiClient } from "@/lib/api";
import type { LoginAttempt, LoginAttemptFilters, LoginAttemptsSummary, PaginatedResponse } from "@/types";

const base = "/api/v1/login_attempts";

export const loginAttemptsService = {
  list: (filters: LoginAttemptFilters): Promise<PaginatedResponse<LoginAttempt>> =>
    apiClient.get(base, { params: filters, paramsSerializer: { indexes: false } }).then((r) => r.data),

  summary: (): Promise<LoginAttemptsSummary> => apiClient.get(`${base}/summary`).then((r) => r.data),
};
