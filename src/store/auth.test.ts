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

describe("roleFor en la vista de empresa (spec 028)", () => {
  const superAdmin = (companies: unknown[]) => makeUser({ role: "super_admin", companies });

  it("sin vista de empresa el super admin es global aunque tenga membresía", () => {
    expect(roleFor(superAdmin([{ id: 10, name: "Uno", role: "owner" }]), 10)).toBe("super_admin");
  });

  it("con vista de empresa usa el rol de su membresía en la empresa activa", () => {
    expect(roleFor(superAdmin([{ id: 10, name: "Uno", role: "owner" }]), 10, true)).toBe("owner");
    expect(roleFor(superAdmin([{ id: 10, name: "Uno", role: "admin" }]), 10, true)).toBe("admin");
  });

  it("con vista de empresa pero sin membresía en esa empresa sigue siendo super admin", () => {
    expect(roleFor(superAdmin([{ id: 10, name: "Uno", role: "owner" }]), 99, true)).toBe("super_admin");
    expect(roleFor(superAdmin([]), null, true)).toBe("super_admin");
  });

  it("la vista de empresa no cambia a quien no es super admin", () => {
    expect(roleFor(makeUser(), 20, true)).toBe("staff");
  });
});

describe("vista de empresa del super admin", () => {
  const owner = { id: 10, name: "Uno", role: "owner" };
  const staff = { id: 20, name: "Dos", role: "staff" };
  const admin = { id: 30, name: "Tres", role: "admin" };

  function login(companies: unknown[]) {
    useAuthStore.getState().setSession({ token: "t", user: makeUser({ role: "super_admin", companies }) } as never);
  }

  it("entra a la primera empresa donde es admin o dueño y escribe el rol efectivo en la cookie", () => {
    login([staff, admin, owner]);
    expect(useAuthStore.getState().role).toBe("super_admin");

    expect(useAuthStore.getState().enterCompanyView()).toBe("admin");

    const s = useAuthStore.getState();
    expect(s.companyView).toBe(true);
    expect(s.selectedCompanyId).toBe(30);
    expect(s.role).toBe("admin");
    expect(cookieValue("user_role")).toBe("admin");
    expect(localStorage.getItem("selected_company_id")).toBe("30");
  });

  it("no entra si solo tiene membresías de manager o staff, ni sin membresías", () => {
    login([staff]);
    expect(useAuthStore.getState().enterCompanyView()).toBeNull();
    expect(useAuthStore.getState().companyView).toBe(false);

    login([]);
    expect(useAuthStore.getState().enterCompanyView()).toBeNull();
    expect(useAuthStore.getState().role).toBe("super_admin");
  });

  it("leaveCompanyView vuelve al rol global y a su cookie", () => {
    login([owner]);
    useAuthStore.getState().enterCompanyView();
    useAuthStore.getState().leaveCompanyView();

    expect(useAuthStore.getState().companyView).toBe(false);
    expect(useAuthStore.getState().role).toBe("super_admin");
    expect(cookieValue("user_role")).toBe("super_admin");
  });

  it("cambiar de empresa dentro de la vista recalcula el rol con la membresía de la nueva", () => {
    login([owner, admin]);
    useAuthStore.getState().enterCompanyView();
    expect(useAuthStore.getState().selectCompany(30)).toBe("admin");
    expect(useAuthStore.getState().companyView).toBe(true);
  });

  it("iniciar y cerrar sesión apagan la vista de empresa", () => {
    login([owner]);
    useAuthStore.getState().enterCompanyView();
    login([owner]);
    expect(useAuthStore.getState().companyView).toBe(false);

    useAuthStore.getState().enterCompanyView();
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().companyView).toBe(false);
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
