import { join } from "node:path";

/** Rol de prueba; el de la membresía en la empresa, o `super_admin` (global). */
export type TestRole = "staff" | "admin" | "owner" | "super_admin";

export const DEMO_PASSWORD = "Demo12345*";
export const SUPER_ADMIN_EMAIL = "draxuvo@mailinator.com";
/** Valor por defecto de db/seeds.rb en desarrollo; CI puede fijar SUPER_ADMIN_PASSWORD. */
export const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin12345*";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:3000";
export const UI_URL = process.env.E2E_UI_URL ?? "http://localhost:4200";

/** Empresas de db/seeds/demo.rb (el dominio es el de los correos y la clave de sesión). */
export const DEMO_COMPANIES = [
  { domain: "donchuy.demo", short: "donchuy", name: "Abarrotes Don Chuy", plan: "basic", status: "active", orderMode: "service" },
  { domain: "volta.demo", short: "volta", name: "Electricidad Volta", plan: "pro", status: "active", orderMode: "service" },
  { domain: "sazon.demo", short: "sazon", name: "Restaurante Sazón", plan: "enterprise", status: "active", orderMode: "order" },
  { domain: "aroma.demo", short: "aroma", name: "Café Aroma", plan: "pro", status: "trialing", orderMode: "order" },
  { domain: "plomeria.demo", short: "plomeria", name: "Plomería Rápida", plan: "pro", status: "expired", orderMode: "service" },
] as const;

export type DemoDomain = (typeof DEMO_COMPANIES)[number]["domain"];

/** Prefijo del correo de cada rol en una empresa demo (`dueno@volta.demo`). */
const ROLE_LOCAL: Record<Exclude<TestRole, "super_admin">, string> = {
  owner: "dueno",
  admin: "admin",
  staff: "staff",
};

export interface TestSession {
  /** `<rol>-<dominio>`, p. ej. `owner-volta.demo`; `multi-demo` y `super_admin-draxuvo`. */
  key: string;
  role: TestRole;
  email: string;
  password: string;
  /** Dominio de la empresa demo; null para el super admin. */
  domain: string | null;
  /** Empresa con la que queda activa la sesión (la primera de la API en usuarios multiempresa). */
  companyName: string | null;
}

const companySessions: TestSession[] = DEMO_COMPANIES.flatMap((c) =>
  (Object.keys(ROLE_LOCAL) as Array<keyof typeof ROLE_LOCAL>).map((role) => ({
    key: `${role}-${c.domain}`,
    role,
    email: `${ROLE_LOCAL[role]}@${c.domain}`,
    password: DEMO_PASSWORD,
    domain: c.domain,
    companyName: c.name,
  })),
);

/** Dueño de Volta y staff de Sazón (rol por empresa, R16). Entra a la primera empresa. */
export const MULTI_SESSION: TestSession = {
  key: "multi-demo",
  role: "owner",
  email: "multi@demo.demo",
  password: DEMO_PASSWORD,
  domain: null,
  companyName: null,
};

export const SUPER_ADMIN_SESSION: TestSession = {
  key: "super_admin-draxuvo",
  role: "super_admin",
  email: SUPER_ADMIN_EMAIL,
  password: SUPER_ADMIN_PASSWORD,
  domain: null,
  companyName: null,
};

/** Todas las sesiones que global-setup guarda: 5 empresas x 3 roles, multi y super admin. */
export const SESSIONS: readonly TestSession[] = [
  ...companySessions,
  MULTI_SESSION,
  SUPER_ADMIN_SESSION,
];

export const AUTH_DIR = join(import.meta.dirname, "..", ".auth");

/** Ruta del estado guardado: `e2e/.auth/<rol>-<dominio>.json`. */
export function authFile(key: string): string {
  return join(AUTH_DIR, `${key}.json`);
}

/** Atajo: `storageStatePath("owner", "volta.demo")`. */
export function storageStatePath(role: TestRole, domain: DemoDomain): string {
  return authFile(`${role}-${domain}`);
}

export function sessionFor(role: TestRole, domain: DemoDomain): TestSession {
  const found = SESSIONS.find((s) => s.key === `${role}-${domain}`);
  if (!found) throw new Error(`No hay sesión ${role}-${domain}`);
  return found;
}

// --- Estado del navegador que lee la UI (src/store/auth.ts y src/proxy.ts) ---

interface LoginCompany {
  id: number;
  role?: string;
}
interface LoginUser {
  role?: string;
  companies?: LoginCompany[];
  [key: string]: unknown;
}
/** Respuesta de POST /api/v1/auth/login. */
export interface LoginResponse {
  token: string;
  user: LoginUser;
}

export interface StorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
  }>;
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
}

/** Empresa activa tras entrar: la primera del usuario (igual que `setSession` del store). */
export function activeCompanyId(user: LoginUser): number | null {
  return user.companies?.[0]?.id ?? null;
}

/** Rol que el panel usa: `super_admin` global o el de la membresía activa. */
export function activeRole(user: LoginUser, companyId: number | null): string | null {
  if (user.role === "super_admin") return "super_admin";
  const membership = user.companies?.find((c) => c.id === companyId) ?? user.companies?.[0];
  return membership?.role ?? user.role ?? null;
}

/**
 * Construye el `storageState` de Playwright desde la respuesta del login:
 * cookies `auth_token` y `user_role` (las lee proxy.ts) y localStorage `auth_token`,
 * `selected_company_id` y `auth-storage` (persist de zustand con token, user,
 * selectedCompanyId y role).
 */
export function buildStorageState(login: LoginResponse, uiUrl: string = UI_URL): StorageState {
  const { token, user } = login;
  const companyId = activeCompanyId(user);
  const role = activeRole(user, companyId);
  const url = new URL(uiUrl);
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const cookie = (name: string, value: string) => ({
    name,
    value,
    domain: url.hostname,
    path: "/",
    expires,
    httpOnly: false,
    secure: false,
    sameSite: "Lax" as const,
  });

  const localStorage = [{ name: "auth_token", value: token }];
  if (companyId) localStorage.push({ name: "selected_company_id", value: String(companyId) });
  localStorage.push({
    name: "auth-storage",
    value: JSON.stringify({
      state: { token, user, selectedCompanyId: companyId, role },
      version: 0,
    }),
  });

  return {
    cookies: [cookie("auth_token", token), ...(role ? [cookie("user_role", role)] : [])],
    origins: [{ origin: url.origin, localStorage }],
  };
}
