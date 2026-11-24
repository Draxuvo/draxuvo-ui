import { describe, expect, it } from "vitest";
import { filtersFromParams, formatWhen, resultTone, todayInMexico, updateParams } from "./login-attempts";

describe("filtros de Accesos en la URL (spec 073)", () => {
  it("lee los filtros válidos e ignora los demás", () => {
    const params = new URLSearchParams(
      "result=failures,wrong_password,otro&q=%20volta%20&company=7&ip=10.0.0.1&channel=app&since=60&from=2026-11-01&to=mal&page=3",
    );
    expect(filtersFromParams(params)).toEqual({
      result: ["failures", "wrong_password"],
      q: "volta",
      company_id: 7,
      ip: "10.0.0.1",
      channel: "app",
      since: 60,
      from: "2026-11-01",
      page: 3,
      page_size: 50,
    });
  });

  it("sin filtros va a la página 1", () => {
    expect(filtersFromParams(new URLSearchParams("channel=fax&since=5000"))).toEqual({ page: 1, page_size: 50 });
  });

  it("un cambio de filtro vuelve a la página 1 y un valor vacío quita la clave", () => {
    const current = new URLSearchParams("q=volta&page=4&ip=10.0.0.1");
    expect(updateParams(current, { ip: "", channel: "panel" })).toBe("q=volta&channel=panel");
    expect(updateParams(current, { page: 5 })).toBe("q=volta&page=5&ip=10.0.0.1");
  });

  it("muestra la hora de México y el día de hoy allá", () => {
    expect(formatWhen("2026-11-24T06:30:00Z", "es")).toContain("00:30");
    expect(todayInMexico(new Date("2026-11-25T03:00:00Z"))).toBe("2026-11-24");
  });

  it("colorea el resultado", () => {
    expect(resultTone("success")).toBe("ok");
    expect(resultTone("wrong_password")).toBe("warn");
    expect(resultTone("rate_limited")).toBe("bad");
  });
});
