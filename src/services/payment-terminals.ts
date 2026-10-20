// src/services/payment-terminals.ts — terminales de cobro del negocio (spec 015).
import { apiClient } from "@/lib/api";
import type { PaymentTerminal, TerminalProvider } from "@/types";

const base = "/api/v1/payment_terminals";

export interface TerminalPayload {
  name: string;
  provider: TerminalProvider;
  active?: boolean;
}

export const paymentTerminalsService = {
  list: ({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<PaymentTerminal[]> =>
    apiClient
      .get(base, { params: includeInactive ? { include_inactive: true } : undefined })
      .then((r) => r.data.results),

  create: (data: TerminalPayload): Promise<PaymentTerminal> =>
    apiClient.post(base, { payment_terminal: data }).then((r) => r.data),

  update: (id: number, data: Partial<TerminalPayload>): Promise<PaymentTerminal> =>
    apiClient.patch(`${base}/${id}`, { payment_terminal: data }).then((r) => r.data),

  destroy: (id: number): Promise<PaymentTerminal> =>
    apiClient.delete(`${base}/${id}`).then((r) => r.data),
};
