// src/store/auth.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/lib/api";
import { queryClient } from "@/lib/query";
import type { AuthResponse, Role, User } from "@/types";

const COMPANY_KEY = "selected_company_id";
const COOKIE_MAX_AGE = 60 * 60 * 24;

/**
 * Rol con el que el panel trata al usuario (R16): `super_admin` es global; para los demás es el
 * rol de su membresía en la empresa activa. Si la sesión guardada es de antes del rol por empresa,
 * cae en `user.role`.
 */
export function roleFor(user: User | null, companyId: number | null): Role | null {
  if (!user) return null;
  if (user.role === "super_admin") return "super_admin";
  const membership =
    user.companies?.find((c) => c.id === companyId) ?? user.companies?.[0];
  return membership?.role ?? user.role ?? null;
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
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  setSession: (session: AuthResponse) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
  /** Actualiza el usuario (p. ej. tras crear una sucursal) conservando la empresa activa si sigue. */
  setUser: (user: User) => void;
  /** Cambia la empresa activa: rol, cookie `user_role` y caché de consultas. Devuelve el rol nuevo. */
  selectCompany: (id: number) => Role | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      selectedCompanyId: null,
      role: null,
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
        set({ token, user, selectedCompanyId, role, isLoading: false });
      },

      logout: () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem(COMPANY_KEY);
        document.cookie = "auth_token=; path=/; max-age=0";
        writeRoleCookie(null);
        queryClient.clear();
        set({ user: null, token: null, selectedCompanyId: null, role: null });
        window.location.href = "/login";
      },

      fetchMe: async () => {
        const res = await apiClient.get<{ user: User }>("/api/v1/auth/me");
        get().setUser(res.data.user);
      },

      setUser: (user) => {
        const selectedCompanyId = companyFor(user, get().selectedCompanyId);
        const role = roleFor(user, selectedCompanyId);
        writeCompany(selectedCompanyId);
        writeRoleCookie(role);
        set({ user, selectedCompanyId, role });
      },

      selectCompany: (id) => {
        const { user } = get();
        const selectedCompanyId = companyFor(user, id);
        const role = roleFor(user, selectedCompanyId);
        writeCompany(selectedCompanyId);
        writeRoleCookie(role);
        // Todo lo cacheado es de la empresa anterior.
        queryClient.clear();
        set({ selectedCompanyId, role });
        return role;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        selectedCompanyId: state.selectedCompanyId,
        role: state.role,
      }),
      // Sesiones guardadas antes del rol por empresa no traen `role`: se deriva al hidratar.
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<AuthState>) };
        return { ...merged, role: roleFor(merged.user, merged.selectedCompanyId) };
      },
    },
  ),
);
