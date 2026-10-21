import { mkdirSync, writeFileSync } from "node:fs";
import { request } from "@playwright/test";
import {
  API_URL,
  AUTH_DIR,
  SESSIONS,
  authFile,
  buildStorageState,
  type LoginResponse,
} from "./support/session";

/**
 * Inicia sesión por API una vez por rol y empresa y guarda el estado del navegador en
 * e2e/.auth/<rol>-<dominio>.json. Se regenera en cada corrida, así que nunca queda vencido.
 */
export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  const api = await request.newContext({ baseURL: API_URL });
  try {
    const failures: string[] = [];
    await Promise.all(
      SESSIONS.map(async (s) => {
        const res = await api.post("/api/v1/auth/login", {
          data: { email: s.email, password: s.password },
        });
        if (!res.ok()) {
          failures.push(`${s.key} (${s.email}): ${res.status()}`);
          return;
        }
        const login = (await res.json()) as LoginResponse;
        // Con una entrada abierta el modal "Marcar entrada" (spec 026) no tapa las pantallas. Quien no
        // es empleado o no tiene el módulo responde 4xx: se ignora.
        const company = login.user.companies?.[0]?.id;
        await api.post("/api/v1/my_attendance/check_in", {
          headers: { Authorization: `Bearer ${login.token}`, ...(company ? { "X-Company-Id": String(company) } : {}) },
          failOnStatusCode: false,
        });
        writeFileSync(authFile(s.key), JSON.stringify(buildStorageState(login), null, 2));
      }),
    );
    if (failures.length) {
      throw new Error(
        `No se pudo iniciar sesión en ${failures.length} sesión(es). ¿La API corre en ${API_URL} con los datos de demo (bin/rails db:reset)?\n  ${failures.join("\n  ")}`,
      );
    }
  } finally {
    await api.dispose();
  }
}
