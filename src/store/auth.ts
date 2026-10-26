// src/store/auth.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/lib/api";
import { applyAppearance, fromPreferences } from "@/lib/appearance";
import { clearDemoInfo } from "@/lib/demo";
import { queryClient } from "@/lib/query";
import type { AuthResponse, Role, User } from "@/types";

const COMPANY_KEY = "selected_company_id";
const COOKIE_MAX_AGE = 60 * 60 * 24;

/**
 * Rol con el que el panel trata al usuario (R16): `super_admin` es global; para los demás es el
 * rol de su membresía en la empresa activa. Si la sesión guardada es de antes del rol por empresa,
 * cae en `user.role`.
 */
export function roleFor(
  user: User | null,
  companyId: number | null,
  companyView = false,
): Role | null {
  if (!user) return null;
  if (user.role === "super_admin") {
    // Vista de empresa (spec 029): el super admin con membresía ve el panel con el rol que tiene ahí.
    // La API lo sigue tratando como super admin, así que conserva sus poderes.
    const own = companyView ? user.companies?.find((c) => c.id === companyId) : undefined;
    return own?.role ?? "super_admin";
  }
  const membership =
    user.companies?.find((c) => c.id === companyId) ?? user.companies?.[0];
  return membership?.role ?? user.role ?? null;
}

/** Empresas donde el usuario es administrador o dueño: a ellas puede entrar el super admin. */
export function companyViewTargets(user: User | null) {
  if (user?.role !== "super_admin") return [];
  return (user.companies ?? []).filter((c) => c.role === "admin" || c.role === "owner");
}

/** Empresa activa válida: la pedida si el usuario pertenece a ella, si no la primera. */
function companyFor(user: User | null, wanted: number | null): number | null {
  if (!user?.companies?.length) return null;
  return user.companies.some((c) => c.id === wanted) ? wanted : user.companies[0].id;
}

// `proxy.ts` lee esta cookie para bloquear rutas por rol.
function writeRoleCookie(role: Role | null) {
  document.cookie = role
    ? `user_role=${role}; path=/; max-age=${COOKIE_MAX_AGE}`
    : "user_role=; path=/; max-age=0";
}

// El modal de entrada se ofrece una vez por sesión (spec 026): al cerrar sesión se olvida.
function clearAttendancePrompts() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("attendance_prompted:"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // sin sessionStorage no hay nada que limpiar
  }
}

function writeCompany(id: number | null) {
  if (id) localStorage.setItem(COMPANY_KEY, String(id));
  else localStorage.removeItem(COMPANY_KEY);
}

interface AuthState {
  user: User | null;
  token: string | null;
  selectedCompanyId: number | null;
  /** Rol en la empresa activa (o `super_admin`). Úsalo en lugar de `user.role`. */
  role: Role | null;
  /** Solo super admin (spec 029): trabaja dentro de su empresa con el rol de su membresía. */
  companyView: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  setSession: (session: AuthResponse) => void;
  logout: () => void;
  /** Cierra la sesión y va a `redirectTo` (p. ej. al salir de una demo: el registro o el sitio público). */
  endSession: (redirectTo: string) => void;
  fetchMe: () => Promise<void>;
  /** Actualiza el usuario (p. ej. tras crear una sucursal) conservando la empresa activa si sigue. */
  setUser: (user: User) => void;
  /** Cambia la empresa activa: rol, cookie `user_role` y caché de consultas. Devuelve el rol nuevo. */
  selectCompany: (id: number) => Role | null;
  /** Entra a la vista de empresa (la activa si es suya como admin/dueño, si no la primera). Null si no puede. */
  enterCompanyView: () => Role | null;
  /** Vuelve al panel global del super admin. */
  leaveCompanyView: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      selectedCompanyId: null,
      role: null,
      companyView: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await apiClient.post<AuthResponse>("/api/v1/auth/login", {
            email,
            password,
          });
          get().setSession(res.data);
        } finally {
          set({ isLoading: false });
        }
      },

      // Persiste una sesión ya emitida por la API (login o registro). Entra a la primera empresa.
      setSession: ({ token, user }) => {
        const selectedCompanyId = companyFor(user, null);
        const role = roleFor(user, selectedCompanyId);
        localStorage.setItem("auth_token", token);
        writeCompany(selectedCompanyId);
        document.cookie = `auth_token=${token}; path=/; max-age=${COOKIE_MAX_AGE}`;
        writeRoleCookie(role);
        queryClient.clear();
        // La preferencia de la cuenta manda sobre la del dispositivo (FR-008).
        applyAppearance(fromPreferences(user.preferences));
        set({ token, user, selectedCompanyId, role, companyView: false, isLoading: false });
      },

      logout: () => get().endSession("/login"),

      endSession: (redirectTo) => {
        localStorage.removeItem("auth_token");
        clearDemoInfo();
        localStorage.removeItem(COMPANY_KEY);
        document.cookie = "auth_token=; path=/; max-age=0";
        writeRoleCookie(null);
        clearAttendancePrompts();
        queryClient.clear();
        set({ user: null, token: null, selectedCompanyId: null, role: null, companyView: false });
        window.location.href = redirectTo;
      },

      fetchMe: async () => {
        const res = await apiClient.get<{ user: User }>("/api/v1/auth/me");
        get().setUser(res.data.user);
      },

      setUser: (user) => {
        const selectedCompanyId = companyFor(user, get().selectedCompanyId);
        const role = roleFor(user, selectedCompanyId, get().companyView);
        writeCompany(selectedCompanyId);
        writeRoleCookie(role);
        if (user.preferences) applyAppearance(fromPreferences(user.preferences));
        // Sin membresía en la empresa activa ya no hay vista de empresa que mantener.
        set({ user, selectedCompanyId, role, companyView: get().companyView && role !== "super_admin" });
      },

      selectCompany: (id) => {
        const { user } = get();
        const selectedCompanyId = companyFor(user, id);
        const role = roleFor(user, selectedCompanyId, get().companyView);
        writeCompany(selectedCompanyId);
        writeRoleCookie(role);
        // Todo lo cacheado es de la empresa anterior.
        queryClient.clear();
        set({ selectedCompanyId, role, companyView: get().companyView && role !== "super_admin" });
        return role;
      },

      enterCompanyView: () => {
        const { user, selectedCompanyId } = get();
        const targets = companyViewTargets(user);
        if (targets.length === 0) return null;
        const target = targets.find((c) => c.id === selectedCompanyId) ?? targets[0];
        const role = roleFor(user, target.id, true);
        writeCompany(target.id);
        writeRoleCookie(role);
        queryClient.clear();
        set({ selectedCompanyId: target.id, role, companyView: true });
        return role;
      },

      leaveCompanyView: () => {
        const { user, selectedCompanyId } = get();
        const role = roleFor(user, selectedCompanyId, false);
        writeRoleCookie(role);
        queryClient.clear();
        set({ role, companyView: false });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        selectedCompanyId: state.selectedCompanyId,
        role: state.role,
        companyView: state.companyView,
      }),
      // Sesiones guardadas antes del rol por empresa no traen `role`: se deriva al hidratar.
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<AuthState>) };
        return { ...merged, role: roleFor(merged.user, merged.selectedCompanyId, merged.companyView) };
      },
    },
  ),
);
