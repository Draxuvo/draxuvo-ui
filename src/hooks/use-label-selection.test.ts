import { beforeEach, describe, expect, it } from "vitest";
import type { Product } from "@/types";
import { clearLabelSelection, readLabelSelection, saveLabelSelection, selectionItem } from "./use-label-selection";

beforeEach(() => window.sessionStorage.clear());

describe("use-label-selection (spec 035)", () => {
  it("guarda y lee la selección", () => {
    const items = [{ id: 1, name: "Cuaderno", copies: 3, barcodes: ["111"], stock: 5, fractional: false, price: 20 }];
    saveLabelSelection(items);
    expect(readLabelSelection()).toEqual(items);
    clearLabelSelection();
    expect(readLabelSelection()).toEqual([]);
  });

  it("ignora basura y renglones inválidos", () => {
    window.sessionStorage.setItem("labelSelection", "{no es json");
    expect(readLabelSelection()).toEqual([]);
    window.sessionStorage.setItem("labelSelection", JSON.stringify([{ id: 1, name: "x", copies: 0, barcodes: [] }, { id: "a" }, null]));
    expect(readLabelSelection()).toEqual([]);
  });

  it("selectionItem: sin existencia si el tipo no se cuenta", () => {
    const product = { id: 2, name: "Servicio", stock: 9, price: 50, barcodes: undefined, product_type: { counted: false, fractional: false } } as unknown as Product;
    expect(selectionItem(product)).toMatchObject({ id: 2, copies: 1, barcodes: [], stock: null, price: 50 });
  });
});
