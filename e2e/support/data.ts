import type { APIRequestContext } from "@playwright/test";
import { passwordToken } from "./tokens";

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
  const companyId = user.company_id ?? user.company?.id ?? user.companies?.[0]?.id ?? null;
  return {
    prefix,
    email,
    password: E2E_PASSWORD,
    companyName,
    token: body.token,
    userId: user.id,
    companyId,
  };
}

export interface NewStaff {
  email: string;
  name: string;
  password: string;
  employeeId: number;
  userId: number;
}

/**
 * Personal de piso (rol staff) de una empresa nueva, con contraseña ya fijada, creado como lo haría el dueño:
 * ficha con acceso y enlace de alta. Úsalo cuando la prueba cambia el estado de la persona (turno, acceso), para no
 * tocar las sesiones de demo que comparten las demás pruebas.
 */
export async function createStaff(request: APIRequestContext, company: NewCompany, prefix: string = company.prefix): Promise<NewStaff> {
  const headers = { Authorization: `Bearer ${company.token}`, "X-Company-Id": String(company.companyId) };
  const email = `${prefix}-staff@mailinator.com`;
  const name = `Personal ${prefix}`;
  const created = await request.post(`${API_URL}/api/v1/employees`, {
    headers,
    data: { employee: { name, email, phone: "5512345678", salary: 8000 }, access: { role: "staff" } },
  });
  if (created.status() !== 201) throw new Error(`createStaff: alta falló (${created.status()}): ${await created.text()}`);
  const employee = await created.json();
  const members = await request.get(`${API_URL}/api/v1/company/members`, { headers });
  const member = (await members.json()).results.find((m: { email: string }) => m.email === email);
  if (!member) throw new Error(`createStaff: ${email} no aparece entre los miembros`);
  const set = await request.put(`${API_URL}/api/v1/passwords/update_with_token`, {
    data: { token: passwordToken({ id: member.id, email, fullName: name }), new_password: E2E_PASSWORD, new_password_confirmation: E2E_PASSWORD },
  });
  if (set.status() !== 200) throw new Error(`createStaff: contraseña falló (${set.status()}): ${await set.text()}`);
  return { email, name, password: E2E_PASSWORD, employeeId: employee.id, userId: member.id };
}
