import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/types";
import { findByCode, resolveProduct } from "./resolve";

const list = [
  { id: 1, name: "Aceite", sku: "AC-1", barcodes: ["7501234567890"] },
  { id: 2, name: "Filtro", sku: "FI-2", barcodes: [] },
];
const remote = (over: Partial<Product>) => ({ id: 9, name: "Insumo", sku: "X", ...over }) as Product;

describe("findByCode (spec 056)", () => {
  it("prefiere el código de barras exacto y luego la clave sin importar mayúsculas", () => {
    expect(findByCode("7501234567890", list)?.id).toBe(1);
    expect(findByCode("fi-2", list)?.id).toBe(2);
    expect(findByCode("7501234567891", list)).toBeNull();
    expect(findByCode("750123456789", list)).toBeNull();
  });
});

describe("resolveProduct (spec 056)", () => {
  it("resuelve contra la lista sin consultar la red", async () => {
    const lookup = vi.fn();
    const result = await resolveProduct("AC-1", list, lookup);
    expect(result).toEqual({ ok: true, product: list[0] });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("código que no existe → not_found", async () => {
    expect(await resolveProduct("000", list, vi.fn(async () => null))).toEqual({ ok: false, reason: "not_found" });
    expect(await resolveProduct("000", list, vi.fn(async () => Promise.reject(new Error("red"))))).toEqual({ ok: false, reason: "not_found" });
  });

  it("existe pero su tipo no se vende → not_sellable con el nombre", async () => {
    const lookup = vi.fn(async () => remote({ product_type: { id: 1, name: "Insumo", sellable: false } as never }));
    expect(await resolveProduct("X", list, lookup)).toEqual({ ok: false, reason: "not_sellable", name: "Insumo" });
  });

  it("en el menú, un producto que sí se vende pero no está en el menú → not_on_menu", async () => {
    const lookup = vi.fn(async () => remote({ product_type: { id: 1, name: "Platillo", sellable: true } as never }));
    expect(await resolveProduct("X", list, lookup, "menu")).toEqual({ ok: false, reason: "not_on_menu", name: "Insumo" });
  });

  it("en un catálogo parcial, un producto vendible que no estaba cargado se acepta", async () => {
    const lookup = vi.fn(async () => remote({ product_type: { id: 1, name: "Refacción", sellable: true } as never }));
    const result = await resolveProduct("X", list, lookup, "catalog");
    expect(result.ok).toBe(true);
  });
});
