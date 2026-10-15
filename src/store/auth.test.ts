import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
vi.mock("@/lib/query", () => ({ queryClient: { clear: vi.fn() } }));
vi.mock("@/lib/appearance", async (orig) => ({
  ...(await orig<typeof import("@/lib/appearance")>()),
  applyAppearance: vi.fn(),
}));

import { applyAppearance } from "@/lib/appearance";
import { queryClient } from "@/lib/query";
import type { User } from "@/types";
import { roleFor, useAuthStore } from "./auth";

function makeUser(overrides: Record<string, unknown> = {}): User {
  return {
    id: 1,
    email: "a@b.c",
    role: "staff",
    companies: [
      { id: 10, name: "Uno", role: "owner" },
      { id: 20, name: "Dos", role: "staff" },
    ],
    ...overrides,
  } as unknown as User;
}

function cookieValue(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, selectedCompanyId: null, role: null, isLoading: false });
  localStorage.clear();
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  });
  vi.clearAllMocks();
});

describe("roleFor", () => {
  it("devuelve null sin usuario", () => {
    expect(roleFor(null, 10)).toBeNull();
  });

  it("super_admin es global sin importar la empresa", () => {
    expect(roleFor(makeUser({ role: "super_admin" }), 20)).toBe("super_admin");
  });

  it("usa el rol de la membresía de la empresa pedida", () => {
    expect(roleFor(makeUser(), 20)).toBe("staff");
    expect(roleFor(makeUser(), 10)).toBe("owner");
  });

  it("cae en la primera empresa si el id no pertenece al usuario", () => {
    expect(roleFor(makeUser(), 999)).toBe("owner");
    expect(roleFor(makeUser(), null)).toBe("owner");
  });

  it("cae en user.role sin empresas y en null si tampoco hay rol", () => {
    expect(roleFor(makeUser({ companies: [] }), null)).toBe("staff");
    expect(roleFor(makeUser({ companies: undefined }), null)).toBe("staff");
    expect(roleFor(makeUser({ companies: [], role: undefined }), null)).toBeNull();
  });
});

describe("useAuthStore", () => {
  it("setSession guarda token, cookies, empresa y rol, limpia la caché y aplica la apariencia", () => {
    const user = makeUser({ preferences: { theme: "mercado", color_mode: "dark" } });
    useAuthStore.getState().setSession({ token: "tok", user } as never);

    const s = useAuthStore.getState();
    expect(s.token).toBe("tok");
    expect(s.user).toBe(user);
    expect(s.selectedCompanyId).toBe(10);
    expect(s.role).toBe("owner");
    expect(localStorage.getItem("auth_token")).toBe("tok");
    expect(localStorage.getItem("selected_company_id")).toBe("10");
    expect(cookieValue("auth_token")).toBe("tok");
    expect(cookieValue("user_role")).toBe("owner");
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(applyAppearance).toHaveBeenCalledWith({ theme: "mercado", mode: "dark" });
  });

  it("setSession sin preferencias aplica la apariencia por defecto", () => {
    useAuthStore.getState().setSession({ token: "t", user: makeUser() } as never);
    expect(applyAppearance).toHaveBeenCalledWith({ theme: "anaquel", mode: "system" });
  });

  it("setSession de un usuario sin empresas no guarda empresa activa", () => {
    useAuthStore.getState().setSession({ token: "t", user: makeUser({ companies: [], role: "super_admin" }) } as never);
    expect(useAuthStore.getState().selectedCompanyId).toBeNull();
    expect(localStorage.getItem("selected_company_id")).toBeNull();
    expect(cookieValue("user_role")).toBe("super_admin");
  });

  it("setUser conserva la empresa activa si sigue existiendo", () => {
    useAuthStore.getState().setSession({ token: "t", user: makeUser() } as never);
    useAuthStore.getState().selectCompany(20);
    useAuthStore.getState().setUser(makeUser());
    expect(useAuthStore.getState().selectedCompanyId).toBe(20);
    expect(useAuthStore.getState().role).toBe("staff");
  });

  it("setUser cae en la primera empresa si la activa ya no existe y aplica preferencias si vienen", () => {
    useAuthStore.setState({ selectedCompanyId: 999 });
    useAuthStore.getState().setUser(makeUser({ preferences: { theme: "grafito", color_mode: "light" } }));
    expect(useAuthStore.getState().selectedCompanyId).toBe(10);
    expect(localStorage.getItem("selected_company_id")).toBe("10");
    expect(applyAppearance).toHaveBeenCalledWith({ theme: "grafito", mode: "light" });
  });

  it("setUser no toca la apariencia sin preferencias", () => {
    useAuthStore.getState().setUser(makeUser());
    expect(applyAppearance).not.toHaveBeenCalled();
  });

  it("selectCompany cambia empresa, cookie de rol y caché, y devuelve el rol nuevo", () => {
    useAuthStore.getState().setSession({ token: "t", user: makeUser() } as never);
    vi.mocked(queryClient.clear).mockClear();

    const role = useAuthStore.getState().selectCompany(20);

    expect(role).toBe("staff");
    expect(useAuthStore.getState().selectedCompanyId).toBe(20);
    expect(useAuthStore.getState().role).toBe("staff");
    expect(localStorage.getItem("selected_company_id")).toBe("20");
    expect(cookieValue("user_role")).toBe("staff");
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
  });

  it("selectCompany con un id inválido cae en la primera empresa", () => {
    useAuthStore.getState().setSession({ token: "t", user: makeUser() } as never);
    expect(useAuthStore.getState().selectCompany(12345)).toBe("owner");
    expect(useAuthStore.getState().selectedCompanyId).toBe(10);
  });

  it("logout limpia sesión, almacenamiento, cookies y caché, y redirige a /login", () => {
    useAuthStore.getState().setSession({ token: "t", user: makeUser() } as never);
    vi.mocked(queryClient.clear).mockClear();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { href: "http://localhost/" } });

    useAuthStore.getState().logout();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.token).toBeNull();
    expect(s.selectedCompanyId).toBeNull();
    expect(s.role).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("selected_company_id")).toBeNull();
    expect(cookieValue("auth_token")).toBeUndefined();
    expect(cookieValue("user_role")).toBeUndefined();
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("/login");

    Object.defineProperty(window, "location", { configurable: true, value: original });
  });
});
