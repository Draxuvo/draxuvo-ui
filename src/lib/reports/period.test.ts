import { describe, expect, it } from "vitest";
import { dayCount, groupByFor, isValidRange, localToday, previousRange, rangeFor } from "./period";

describe("periodo de Reportes", () => {
  it("calcula los atajos con la fecha dada", () => {
    expect(rangeFor("hoy", "2026-10-21")).toEqual({ from: "2026-10-21", to: "2026-10-21" });
    expect(rangeFor("7d", "2026-10-21")).toEqual({ from: "2026-10-15", to: "2026-10-21" });
    expect(rangeFor("mes", "2026-10-21")).toEqual({ from: "2026-10-01", to: "2026-10-21" });
    expect(rangeFor("mes-anterior", "2026-10-21")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("el mes anterior de enero es diciembre del año previo", () => {
    expect(rangeFor("mes-anterior", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("personalizado usa las fechas válidas y si no cae en el mes en curso", () => {
    expect(rangeFor("personalizado", "2026-10-21", { from: "2026-02-01", to: "2026-02-10" })).toEqual({
      from: "2026-02-01",
      to: "2026-02-10",
    });
    expect(rangeFor("personalizado", "2026-10-21", { from: "2026-02-10", to: "2026-02-01" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-21",
    });
    expect(rangeFor("personalizado", "2026-10-21")).toEqual({ from: "2026-10-01", to: "2026-10-21" });
  });

  it("valida que Hasta no sea anterior a Desde", () => {
    expect(isValidRange({ from: "2026-10-01", to: "2026-10-01" })).toBe(true);
    expect(isValidRange({ from: "2026-10-02", to: "2026-10-01" })).toBe(false);
    expect(isValidRange({ from: "", to: "2026-10-01" })).toBe(false);
  });

  it("el periodo anterior tiene la misma duración y termina el día antes", () => {
    expect(previousRange({ from: "2026-10-01", to: "2026-10-21" })).toEqual({ from: "2026-09-10", to: "2026-09-30" });
    expect(previousRange({ from: "2026-03-01", to: "2026-03-31" })).toEqual({ from: "2026-01-29", to: "2026-02-28" });
    expect(previousRange({ from: "2026-10-21", to: "2026-10-21" })).toEqual({ from: "2026-10-20", to: "2026-10-20" });
    expect(dayCount({ from: "2026-10-01", to: "2026-10-21" })).toBe(21);
  });

  it("deduce la agrupación de la duración", () => {
    expect(groupByFor({ from: "2026-10-01", to: "2026-10-31" })).toBe("day");
    expect(groupByFor({ from: "2026-09-01", to: "2026-10-02" })).toBe("week");
    expect(groupByFor({ from: "2026-04-01", to: "2026-10-03" })).toBe("week");
    expect(groupByFor({ from: "2026-01-01", to: "2026-12-31" })).toBe("month");
  });

  it("hoy es la fecha local, no la de UTC", () => {
    // 20:00 en México = 02:00 UTC del día siguiente.
    expect(localToday(new Date(2026, 9, 21, 20, 0))).toBe("2026-10-21");
  });
});
