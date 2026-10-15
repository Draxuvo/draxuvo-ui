import type { APIRequestContext } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000";

export const E2E_PASSWORD = "E2e12345*";

/** Prefijo único por prueba y corrida: e2e-<tiempo en base 36>-<worker>. */
export function uniquePrefix(workerIndex = 0): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `e2e-${Date.now().toString(36)}${rand}-${workerIndex}`;
}

export interface NewCompany {
  prefix: string;
  email: string;
  password: string;
  companyName: string;
  token: string;
  userId: number;
  companyId: number | null;
}

export interface NewCompanyOptions {
  workerIndex?: number;
  plan?: string;
  billingCycle?: string;
}

/**
 * Crea una empresa nueva (dueño, prueba de 30 días) por POST /api/v1/registrations.
 * Úsala en pruebas que cambian plan, módulos, modo de órdenes o miembros.
 * Nota: la API limita el registro a 5 por hora por IP.
 */
export async function createCompany(
  request: APIRequestContext,
  opts: NewCompanyOptions = {},
): Promise<NewCompany> {
  const prefix = uniquePrefix(opts.workerIndex);
  const email = `${prefix}@mailinator.com`;
  const companyName = `Empresa ${prefix}`;
  const res = await request.post(`${API_URL}/api/v1/registrations`, {
    data: {
      registration: {
        first_name: "E2E",
        last_name: prefix,
        phone: "5512345678",
        email,
        password: E2E_PASSWORD,
        company_name: companyName,
        plan: opts.plan ?? "basic",
        billing_cycle: opts.billingCycle ?? "monthly",
      },
    },
  });
  if (!res.ok()) {
    throw new Error(`createCompany: registro falló (${res.status()}): ${await res.text()}`);
  }
  const body = await res.json();
  const user = body.user ?? {};
  return {
    prefix,
    email,
    password: E2E_PASSWORD,
    companyName,
    token: body.token,
    userId: user.id,
    companyId: user.company_id ?? user.company?.id ?? null,
  };
}
