// src/hooks/use-payment-terminals.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentTerminalsService, type TerminalPayload } from "@/services/payment-terminals";
import { useModuleGate } from "@/components/subscription/module-locked";

const KEY = ["payment-terminals"] as const;

/**
 * Activas para cobrar; con `includeInactive` (admin) también las desactivadas. Terminales es un módulo del plan
 * (spec 030): si está bloqueado no se consulta y la lista queda vacía (sin selector ni avisos de error).
 */
export function usePaymentTerminals({ includeInactive = false, enabled = true }: { includeInactive?: boolean; enabled?: boolean } = {}) {
  const gate = useModuleGate("terminals");
  return useQuery({
    queryKey: [...KEY, includeInactive ? "all" : "active"],
    queryFn: () => paymentTerminalsService.list({ includeInactive }),
    enabled: enabled && gate.enabled,
  });
}

function useTerminalMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export const useCreateTerminal = () => useTerminalMutation((data: TerminalPayload) => paymentTerminalsService.create(data));

export const useUpdateTerminal = () =>
  useTerminalMutation(({ id, data }: { id: number; data: Partial<TerminalPayload> }) => paymentTerminalsService.update(id, data));

export const useDeleteTerminal = () => useTerminalMutation((id: number) => paymentTerminalsService.destroy(id));
