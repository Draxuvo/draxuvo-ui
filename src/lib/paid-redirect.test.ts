import { describe, expect, it } from "vitest";
import { buildPaidRedirect } from "./paid-redirect";

describe("buildPaidRedirect", () => {
  it("lleva a la pestaña Cobradas sin filtros", () => {
    expect(buildPaidRedirect("es", "/ordenes", {})).toBe("/es/ordenes?vista=cobradas");
    expect(buildPaidRedirect("es", "/mis-ordenes", {})).toBe("/es/mis-ordenes?vista=cobradas");
  });

  it("conserva estado, búsqueda y página", () => {
    expect(buildPaidRedirect("es", "/ordenes", { status: "paid", search: "T-0001", page: "3" })).toBe(
      "/es/ordenes?vista=cobradas&status=paid&search=T-0001&page=3",
    );
  });

  it("descarta un estado inválido, una página no numérica y cualquier otro parámetro", () => {
    expect(buildPaidRedirect("es", "/ordenes", { status: "otro", page: "abc", foo: "1" })).toBe("/es/ordenes?vista=cobradas");
    expect(buildPaidRedirect("es", "/ordenes", { page: "0" })).toBe("/es/ordenes?vista=cobradas");
  });

  it("ignora una vista entrante y toma el primer valor de un arreglo", () => {
    expect(buildPaidRedirect("es", "/ordenes", { vista: "activas", status: ["voided", "paid"] })).toBe("/es/ordenes?vista=cobradas&status=voided");
  });

  it("respeta el idioma y codifica la búsqueda", () => {
    expect(buildPaidRedirect("en", "/ordenes", { search: "Mesa 3 & más" })).toBe("/en/ordenes?vista=cobradas&search=Mesa+3+%26+m%C3%A1s");
  });
});
