// src/components/terminal-charge/use-terminal-charge.ts — una solicitud de cobro en terminal integrada (spec 069, US1):
// la crea, la consulta cada 2 s mientras espera y avisa una sola vez cuando se aplica.
"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { terminalChargesService, type TerminalChargeInput } from "@/services/terminal-charges";
import type { TerminalCharge } from "@/types";

const WAITING = new Set(["pending", "canceling", "approved"]);
export const POLL_MS = 2000;

export interface TerminalChargeError {
  code: string;
  terminalChargeId?: number;
  by?: string;
  /** `incomplete_items`: cuántos artículos faltan por entregar. */
  pending?: number;
}

function toError(error: unknown): TerminalChargeError {
  const details = isAxiosError(error) ? error.response?.data?.error?.details : undefined;
  if (details && typeof details === "object" && "code" in details) {
    return { code: String(details.code), terminalChargeId: details.terminal_charge_id, by: details.by, pending: details.pending };
  }
  return { code: "generic" };
}

export function useTerminalCharge({
  onApplied,
  onStartError,
}: {
  onApplied: (charge: TerminalCharge) => void;
  /** Deja que la pantalla atienda un error del cobro de siempre (p. ej. artículos sin entregar); true si lo atendió. */
  onStartError?: (error: TerminalChargeError) => boolean;
}) {
  const [chargeId, setChargeId] = useState<number | null>(null);
  const [startError, setStartError] = useState<TerminalChargeError | null>(null);
  const appliedRef = useRef<number | null>(null);
  const onAppliedRef = useRef(onApplied);
  useEffect(() => {
    onAppliedRef.current = onApplied;
  });

  const query = useQuery({
    queryKey: ["terminal-charge", chargeId],
    queryFn: () => terminalChargesService.get(chargeId as number),
    enabled: chargeId != null,
    refetchInterval: (q) => (q.state.data && !WAITING.has(q.state.data.status) ? false : POLL_MS),
  });
  const charge = chargeId != null ? (query.data ?? null) : null;

  useEffect(() => {
    if (charge?.status === "applied" && appliedRef.current !== charge.id) {
      appliedRef.current = charge.id;
      onAppliedRef.current(charge);
    }
  }, [charge]);

  const create = useMutation({
    mutationFn: (input: TerminalChargeInput) => terminalChargesService.create(input),
    onSuccess: (created) => {
      setStartError(null);
      setChargeId(created.id);
    },
    onError: (error) => {
      const parsed = toError(error);
      // Un reintento sobre el mismo cobro: se retoma la solicitud que ya está esperando.
      if (parsed.code === "terminal_charge_pending" && parsed.terminalChargeId) return void setChargeId(parsed.terminalChargeId);
      if (onStartError?.(parsed)) return;
      setStartError(parsed);
    },
  });

  const cancel = useMutation({
    mutationFn: (id: number) => terminalChargesService.cancel(id),
    onSuccess: () => void query.refetch(),
    onError: (error) => setStartError(toError(error)),
  });

  const abandon = useMutation({ mutationFn: (id: number) => terminalChargesService.abandon(id) });

  return {
    charge,
    starting: create.isPending,
    startError,
    active: chargeId != null || create.isPending || startError != null,
    start: (input: TerminalChargeInput) => {
      setStartError(null);
      create.mutate(input);
    },
    cancel: () => charge && cancel.mutate(charge.id),
    canceling: cancel.isPending,
    /** Respaldo manual (US3): suelta la solicitud y devuelve a la captura. */
    abandon: async () => {
      if (charge && (charge.status === "pending" || charge.status === "canceling")) await abandon.mutateAsync(charge.id);
      setChargeId(null);
      setStartError(null);
    },
    reset: () => {
      setChargeId(null);
      setStartError(null);
    },
  };
}
