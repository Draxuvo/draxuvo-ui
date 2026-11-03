import { describe, expect, it } from "vitest";
import { errorCode, formatMoney, nextQuantity, quantityStep } from "../lib";

describe("reglas de la caja (spec 050)", () => {
  it("la cantidad sube y baja de uno en uno y de medio en medio si es fraccionaria", () => {
    expect(quantityStep(false)).toBe(1);
    expect(quantityStep(true)).toBe(0.5);
    expect(nextQuantity(2, 1, false)).toBe(3);
    expect(nextQuantity(1.5, 1, true)).toBe(2);
  });

  it("nunca baja de cero: cero quita el renglón", () => {
    expect(nextQuantity(1, -1, false)).toBe(0);
    expect(nextQuantity(0.5, -1, false)).toBe(0);
    expect(nextQuantity(0, -1, true)).toBe(0);
  });

  it("formatea pesos mexicanos en español y en inglés", () => {
    expect(formatMoney("85.5", "es")).toBe("$85.50");
    expect(formatMoney(1234.5, "en")).toBe("MX$1,234.50");
    expect(formatMoney(null, "es")).toBe("$0.00");
  });

  it("lee el código de error de la API", () => {
    expect(errorCode({ response: { data: { error: { details: { code: "product_inactive" } } } } })).toBe("product_inactive");
    expect(errorCode({ response: { data: { error: { code: "x" } } } })).toBe("x");
    expect(errorCode(new Error("sin respuesta"))).toBeUndefined();
  });
});
