import { describe, expect, it } from "vitest";
import { variation } from "./variation";

describe("variation", () => {
  it("10 000 contra 8 000 de ingresos es +25 % y favorable", () => {
    expect(variation(10_000, 8_000, "up")).toEqual({ pct: 25, direction: "up", favorable: true });
  });

  it("gastos a la baja son favorables", () => {
    expect(variation(90, 100, "down")).toEqual({ pct: -10, direction: "down", favorable: true });
  });

  it("gastos al alza no son favorables", () => {
    expect(variation(120, 100, "down")).toMatchObject({ direction: "up", favorable: false });
  });

  it("sin cambio no es ni bueno ni malo", () => {
    expect(variation(100, 100, "up")).toEqual({ pct: 0, direction: "flat", favorable: null });
  });

  it("sin periodo anterior no hay porcentaje ni juicio", () => {
    expect(variation(500, 0, "up")).toEqual({ pct: null, direction: "up", favorable: null });
    expect(variation(0, 0, "up")).toEqual({ pct: null, direction: "flat", favorable: null });
  });

  it("redondea a un decimal", () => {
    expect(variation(1_001, 1_000, "up").pct).toBe(0.1);
    expect(variation(2, 3, "up").pct).toBe(-33.3);
  });
});
