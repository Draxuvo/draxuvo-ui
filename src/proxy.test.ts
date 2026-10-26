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
