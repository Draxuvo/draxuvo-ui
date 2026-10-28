// src/hooks/use-whatsapp.ts — estado de WhatsApp (spec 047). Sin sondeo: la verificación con Meta es solo manual.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsappError } from "@/lib/whatsapp";
import { whatsappService, type ConnectionPayload, type MessageTypePayload } from "@/services/whatsapp";
import type { WhatsappKind, WhatsappState } from "@/types";

export const WHATSAPP_KEY = ["whatsapp"] as const;
const EVENTS_KEY = [...WHATSAPP_KEY, "events"] as const;

/** Historial de la configuración, paginado, el más reciente primero. */
export function useWhatsappEvents(page: number, pageSize = 10) {
  return useQuery({
    queryKey: [...EVENTS_KEY, page, pageSize],
    queryFn: () => whatsappService.events({ page, page_size: pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useWhatsappState() {
  return useQuery({ queryKey: WHATSAPP_KEY, queryFn: whatsappService.state });
}

/**
 * Toda acción devuelve el estado completo y lo deja en caché. Con un 409 (otra persona cambió lo mismo) la API manda el
 * estado vigente: se pone en caché para que la pantalla muestre el valor actual antes de volver a intentarlo.
 */
function useStateMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<WhatsappState>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (state) => {
      qc.setQueryData(WHATSAPP_KEY, state);
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
    onError: (error) => {
      const { status, current } = whatsappError(error);
      if (status === 409 && current) qc.setQueryData(WHATSAPP_KEY, current);
    },
  });
}

export function useSaveConnection() {
  return useStateMutation((payload: ConnectionPayload) => whatsappService.saveConnection(payload));
}

export function useVerifyConnection() {
  return useStateMutation(() => whatsappService.verifyConnection());
}

export function useGuide() {
  return useQuery({ queryKey: [...WHATSAPP_KEY, "guide"], queryFn: whatsappService.guide, staleTime: Infinity });
}

/** Manda un mensaje de prueba. Cuente o no (un rechazo también cuenta), se vuelve a leer el estado para las pruebas restantes. */
export function useTestMessage(kind: WhatsappKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) => whatsappService.testMessage(kind, phone),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: WHATSAPP_KEY, exact: true });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}

export function useSetChannel() {
  return useStateMutation((payload: { enabled: boolean; lock_version?: number }) => whatsappService.setChannel(payload));
}

export function useUpdateMessageType(kind: WhatsappKind) {
  return useStateMutation((payload: MessageTypePayload) => whatsappService.updateMessageType(kind, payload));
}

export function useVerifyMessageType(kind: WhatsappKind) {
  return useStateMutation(() => whatsappService.verifyMessageType(kind));
}

export function useDisconnect() {
  return useStateMutation((payload: { confirm?: boolean; lock_version?: number }) => whatsappService.disconnect(payload));
}
