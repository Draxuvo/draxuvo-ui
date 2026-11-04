import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const passthrough = vi.hoisted(() => ({ sentinel: { passthrough: true } }));
vi.mock("next-intl/middleware", () => ({ default: () => () => passthrough.sentinel }));

import middleware from "./proxy";

const request = (path: string, cookie = "") => new NextRequest(`http://localhost:4200${path}`, { headers: cookie ? { cookie } : {} });
const location = (res: unknown) => (res as Response).headers?.get?.("location") ?? null;

describe("proxy: la demo (spec 039)", () => {
  it("/demo y /demo/<token> son públicas sin sesión", () => {
    expect(middleware(request("/es/demo"))).toBe(passthrough.sentinel);
    expect(middleware(request("/es/demo/abc123"))).toBe(passthrough.sentinel);
    expect(middleware(request("/en/demo?plan=pro"))).toBe(passthrough.sentinel);
  });

  it("a diferencia de /login, no redirigen a quien ya tiene sesión", () => {
    const withSession = "auth_token=jwt; user_role=owner";

    expect(location(middleware(request("/es/login", withSession)))).toContain("/es/inicio");
    expect(middleware(request("/es/demo", withSession))).toBe(passthrough.sentinel);
    expect(middleware(request("/es/demo/abc123", withSession))).toBe(passthrough.sentinel);
  });

  it("el resto del panel sigue pidiendo sesión", () => {
    expect(location(middleware(request("/es/inicio")))).toContain("/es/login");
  });
});

describe("proxy: ventas de mostrador (spec 050)", () => {
  const staff = "auth_token=jwt; user_role=staff";
  const owner = "auth_token=jwt; user_role=owner";

  it("el personal puede entrar a la caja y a sus ventas", () => {
    expect(middleware(request("/es/venta", staff))).toBe(passthrough.sentinel);
    expect(middleware(request("/es/mis-ventas", staff))).toBe(passthrough.sentinel);
  });

  it("el historial completo es del panel: al personal lo manda a sus órdenes", () => {
    expect(location(middleware(request("/es/ventas", staff)))).toContain("/es/mis-ordenes");
  });

  it("el personal no abre Reportes, Suscripción ni Alertas por URL (spec 052, H-06)", () => {
    for (const path of ["/es/reportes", "/es/suscripcion", "/es/alertas"]) {
      expect(location(middleware(request(path, staff)))).toContain("/es/mis-ordenes");
    }
  });

  it("dueño y administrador entran al historial", () => {
    expect(middleware(request("/es/ventas", owner))).toBe(passthrough.sentinel);
  });

  it("sin sesión pide iniciar sesión", () => {
    expect(location(middleware(request("/es/venta")))).toContain("/es/login");
  });
});

describe("proxy: pantallas del super admin (spec 055, H-57)", () => {
  const paths = ["/es/empresas", "/es/usuarios", "/es/demos", "/es/suscripciones", "/es/estadisticas", "/es/whatsapp", "/en/usuarios", "/es/empresas/12"];

  it("dueño y administrador vuelven a su inicio", () => {
    for (const role of ["owner", "admin"]) {
      for (const path of paths) expect(location(middleware(request(path, `auth_token=jwt; user_role=${role}`))), `${role} ${path}`).toContain("/inicio");
    }
  });

  it("el personal vuelve a sus órdenes", () => {
    for (const path of paths) expect(location(middleware(request(path, "auth_token=jwt; user_role=staff"))), path).toContain("/mis-ordenes");
  });

  it("el super admin entra a todas", () => {
    for (const path of paths) expect(middleware(request(path, "auth_token=jwt; user_role=super_admin")), path).toBe(passthrough.sentinel);
  });

  it("sin sesión pide iniciar sesión", () => {
    for (const path of paths) expect(location(middleware(request(path))), path).toContain("/login");
  });

  it("no confunde con las rutas del cliente (`/suscripcion`, `/demo`)", () => {
    expect(middleware(request("/es/suscripcion", "auth_token=jwt; user_role=owner"))).toBe(passthrough.sentinel);
    expect(middleware(request("/es/demo", "auth_token=jwt; user_role=owner"))).toBe(passthrough.sentinel);
  });
});
