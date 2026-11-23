// src/services/terminal-connections.ts — conexiones con proveedores de terminal (spec 069, contracts/api.md).
import { apiClient } from "@/lib/api";
import type { PaginatedResponse, TerminalConnection, TerminalDevice, TerminalProvider, TerminalProviderEntry } from "@/types";

const base = "/api/v1/terminal_connections";

export const terminalConnectionsService = {
  list: (): Promise<TerminalProviderEntry[]> => apiClient.get(base).then((r) => r.data.providers),

  /** URL del proveedor para autorizar a Draxuvo (OAuth). */
  authorize: (provider: TerminalProvider): Promise<string> =>
    apiClient.post(`${base}/${provider}/authorize`).then((r) => r.data.url),

  /** La página de regreso reenvía el código y el `state`; la pantalla muestra el error por su cuenta. */
  callback: (provider: TerminalProvider, code: string, state: string): Promise<TerminalConnection> =>
    apiClient.post(`${base}/${provider}/callback`, { code, state }, { skipErrorToast: true }).then((r) => r.data),

  /** Credenciales propias: el Access Token de la aplicación del negocio (vacío = conservar) y la clave de los avisos. */
  saveCredentials: (provider: TerminalProvider, data: { access_token: string; webhook_secret?: string }): Promise<TerminalConnection> =>
    apiClient.put(`${base}/${provider}/credentials`, data, { skipErrorToast: true }).then((r) => r.data),

  disconnect: (id: number): Promise<TerminalConnection> => apiClient.delete(`${base}/${id}`).then((r) => r.data),

  devices: (id: number, params: { page?: number; page_size?: number; search?: string } = {}): Promise<PaginatedResponse<TerminalDevice>> =>
    apiClient.get(`${base}/${id}/devices`, { params: { page_size: 50, ...params } }).then((r) => r.data),
};
