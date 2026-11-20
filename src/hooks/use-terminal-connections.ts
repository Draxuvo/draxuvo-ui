// src/hooks/use-terminal-connections.ts — conexiones con proveedores de terminal y dispositivos (spec 069).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { terminalConnectionsService } from "@/services/terminal-connections";
import { paymentTerminalsService } from "@/services/payment-terminals";
import { useModuleGate } from "@/components/subscription/module-locked";
import type { TerminalProvider } from "@/types";

const KEY = ["terminal-connections"] as const;
const TERMINALS_KEY = ["payment-terminals"] as const;

export function useTerminalConnections({ enabled = true }: { enabled?: boolean } = {}) {
  const gate = useModuleGate("terminals");
  return useQuery({ queryKey: KEY, queryFn: terminalConnectionsService.list, enabled: enabled && gate.enabled });
}

export function useTerminalDevices(connectionId: number | null, search = "") {
  return useQuery({
    queryKey: [...KEY, connectionId, "devices", search],
    queryFn: () => terminalConnectionsService.devices(connectionId as number, search ? { search } : {}),
    enabled: connectionId != null,
  });
}

/** Lleva al proveedor para autorizar; al volver, la página `/terminales/mercado-pago` termina la conexión. */
export function useAuthorizeConnection() {
  return useMutation({
    mutationFn: (provider: TerminalProvider) => terminalConnectionsService.authorize(provider),
    onSuccess: (url) => {
      window.location.assign(url);
    },
  });
}

function useInvalidating<T, R>(fn: (input: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: TERMINALS_KEY });
    },
  });
}

export const useConnectCallback = () =>
  useInvalidating(({ provider, code, state }: { provider: TerminalProvider; code: string; state: string }) =>
    terminalConnectionsService.callback(provider, code, state),
  );

export const useDisconnect = () => useInvalidating((id: number) => terminalConnectionsService.disconnect(id));

export const useLinkTerminal = () =>
  useInvalidating((data: { name: string; terminal_connection_id: number; device_id: string }) => paymentTerminalsService.link(data));

export const usePrepareTerminal = () => useInvalidating((id: number) => paymentTerminalsService.prepare(id));

export const useUnlinkTerminal = () => useInvalidating((id: number) => paymentTerminalsService.unlink(id));
