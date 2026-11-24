// src/hooks/use-login-attempts.ts — bitácora de inicios de sesión (spec 073).
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { loginAttemptsService } from "@/services/login-attempts";
import type { LoginAttemptFilters } from "@/types";

export const LOGIN_ATTEMPTS_KEY = ["login-attempts"] as const;

export function useLoginAttempts(filters: LoginAttemptFilters, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...LOGIN_ATTEMPTS_KEY, filters],
    queryFn: () => loginAttemptsService.list(filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLoginAttemptsSummary({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: [...LOGIN_ATTEMPTS_KEY, "summary"], queryFn: loginAttemptsService.summary, enabled });
}
