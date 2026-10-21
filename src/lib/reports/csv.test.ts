import { describe, expect, it } from "vitest";
import { csvFilename, toCsv } from "./csv";

type Row = { name: string; total: number | null };
const columns = [
  { header: "Empleado", value: (r: Row) => r.name },
  { header: "Total", value: (r: Row) => r.total },
];

describe("toCsv", () => {
  it("empieza con BOM, usa CRLF y escribe encabezado más filas", () => {
    const csv = toCsv(columns, [{ name: "Ana", total: 1200.5 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe("Empleado,Total\r\nAna,1200.5\r\n");
  });

  it("escapa comas, comillas y saltos de línea", () => {
    const csv = toCsv(columns, [{ name: 'Pérez, "Beto"\nJr', total: 1 }]);
    expect(csv).toContain('"Pérez, ""Beto""\nJr",1');
  });

  it("conserva los acentos y deja vacío lo nulo", () => {
    const csv = toCsv(columns, [{ name: "María Ñandú", total: null }]);
    expect(csv).toContain("María Ñandú,\r\n");
  });

  it("neutraliza textos que una hoja de cálculo tomaría por fórmula", () => {
    const csv = toCsv(columns, [{ name: "=HYPERLINK(1)", total: -5 }]);
    expect(csv).toContain("'=HYPERLINK(1),-5");
  });

  it("sin filas solo trae el encabezado", () => {
    expect(toCsv(columns, []).slice(1)).toBe("Empleado,Total\r\n");
  });

  it("nombra el archivo con la tabla y el rango", () => {
    expect(csvFilename("ingresos", { from: "2026-10-01", to: "2026-10-21" })).toBe(
      "reportes-ingresos-2026-10-01_2026-10-21.csv",
    );
  });
});
