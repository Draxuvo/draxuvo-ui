import { describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/browser";
import type { ErrorEvent } from "@sentry/browser";
import { beforeBreadcrumb, beforeSend, initMonitoring, scrubUrl, setMonitoringUser } from "./monitoring";

vi.mock("@sentry/browser", () => ({ init: vi.fn(), setUser: vi.fn(), setTag: vi.fn() }));

// Spec 071: ningún error del panel sale con query string, tokens de la ruta ni datos del usuario.
describe("monitoring", () => {
  it("scrubUrl quita query, hash y el token de la invitación a la demo", () => {
    expect(scrubUrl("https://app.draxuvo.com/es/ordenes?search=Juan&page=2#x")).toBe("https://app.draxuvo.com/es/ordenes");
    expect(scrubUrl("/es/demo/abc123XYZ?plan=pro")).toBe("/es/demo/:token");
    expect(scrubUrl(undefined)).toBeUndefined();
  });

  it("beforeSend deja solo el id del usuario y la ruta limpia", () => {
    const event = {
      request: {
        url: "https://app.draxuvo.com/es/restablecer?token=secreto",
        query_string: "token=secreto",
        cookies: { auth_token: "jwt" },
        data: { email: "cliente@correo.com" },
        headers: { "User-Agent": "Mozilla/5.0", Authorization: "Bearer jwt" },
      },
      transaction: "/es/demo/abc123",
      user: { id: "42", email: "dueno@negocio.mx", ip_address: "187.0.0.1", username: "Dueño" },
    } as unknown as ErrorEvent;

    const clean = beforeSend(event);
    const dumped = JSON.stringify(clean);

    expect(clean.request?.url).toBe("https://app.draxuvo.com/es/restablecer");
    expect(clean.request?.headers).toEqual({ "User-Agent": "Mozilla/5.0" });
    expect(clean.transaction).toBe("/es/demo/:token");
    expect(clean.user).toEqual({ id: "42" });
    for (const secret of ["secreto", "jwt", "cliente@correo.com", "dueno@negocio.mx", "187.0.0.1", "Dueño"]) {
      expect(dumped).not.toContain(secret);
    }
  });

  it("beforeBreadcrumb limpia las URLs y descarta la consola", () => {
    expect(beforeBreadcrumb({ category: "fetch", data: { url: "https://api.draxuvo.com/api/v1/products?search=Juan" } })?.data?.url).toBe(
      "https://api.draxuvo.com/api/v1/products",
    );
    expect(beforeBreadcrumb({ category: "navigation", data: { from: "/es/demo/tok", to: "/es/ordenes?x=1" } })?.data).toEqual({
      from: "/es/demo/:token",
      to: "/es/ordenes",
    });
    expect(beforeBreadcrumb({ category: "console", message: "cliente@correo.com" })).toBeNull();
  });

  it("sin DSN no inicializa ni fija usuario", () => {
    expect(initMonitoring("")).toBe(false);
    setMonitoringUser(42, 23);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
  });

  it("con DSN inicializa una vez, sin PII ni tracing, y fija solo ids", () => {
    expect(initMonitoring("https://abc@o1.ingest.sentry.io/1")).toBe(true);
    expect(initMonitoring("https://abc@o1.ingest.sentry.io/1")).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Sentry.init).mock.calls[0][0]).toMatchObject({
      dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false },
      tracesSampleRate: 0,
    });

    setMonitoringUser(42, 23, true);
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: "42" });
    expect(Sentry.setTag).toHaveBeenCalledWith("company_id", "23");
    expect(Sentry.setTag).toHaveBeenCalledWith("demo", "true");

    setMonitoringUser(null, null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  });
});
