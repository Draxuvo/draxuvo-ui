import { apiClient } from "@/lib/api";
import type { AuthResponse, RegistrationPayload } from "@/types";

// Pública: crea empresa, dueño y prueba de 30 días. Responde como POST /auth/login.
export const createRegistration = (payload: RegistrationPayload): Promise<AuthResponse> =>
  apiClient
    .post("/api/v1/registrations", { registration: payload })
    .then((r) => r.data);

export const registrationsService = {
  create: createRegistration,
};
