// src/hooks/use-whatsapp.ts — estado de WhatsApp (spec 047). Sin sondeo: la verificación con Meta es solo manual.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsappError } from "@/lib/whatsapp";
import { whatsappService, type ConnectionPayload, type MessageTypePayload } from "@/services/whatsapp";
import type { WhatsappKind, WhatsappState } from "@/types";

export const WHATSAPP_KEY = ["whatsapp"] as const;

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
    onSuccess: (state) => qc.setQueryData(WHATSAPP_KEY, state),
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

export function useUpdateMessageType(kind: WhatsappKind) {
  return useStateMutation((payload: MessageTypePayload) => whatsappService.updateMessageType(kind, payload));
}

export function useVerifyMessageType(kind: WhatsappKind) {
  return useStateMutation(() => whatsappService.verifyMessageType(kind));
}

export function useDisconnect() {
  return useStateMutation((payload: { confirm?: boolean; lock_version?: number }) => whatsappService.disconnect(payload));
}
