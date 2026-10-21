import { describe, expect, it } from "vitest";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import { isProductIconKey, PRODUCT_ICON_GROUPS, PRODUCT_ICON_KEYS } from "./catalog";
import { resolveProductIcon } from "./resolve";
import { SHAPES } from "./shapes";

describe("catálogo de iconos de producto (spec 026)", () => {
  it("tiene 54 claves únicas, cada una con trazo y nombre en es y en", () => {
    expect(PRODUCT_ICON_KEYS).toHaveLength(54);
    expect(new Set(PRODUCT_ICON_KEYS).size).toBe(54);
    for (const key of PRODUCT_ICON_KEYS) {
      expect(SHAPES[key].length, key).toBeGreaterThan(0);
      expect((es.productIcons.names as Record<string, string>)[key], `es ${key}`).toBeTruthy();
      expect((en.productIcons.names as Record<string, string>)[key], `en ${key}`).toBeTruthy();
    }
    for (const group of Object.keys(PRODUCT_ICON_GROUPS)) {
      expect((es.productIcons.groups as Record<string, string>)[group], group).toBeTruthy();
      expect((en.productIcons.groups as Record<string, string>)[group], group).toBeTruthy();
    }
  });

  it("solo reconoce claves del catálogo", () => {
    expect(isProductIconKey("taco")).toBe(true);
    expect(isProductIconKey("nope")).toBe(false);
    expect(isProductIconKey(null)).toBe(false);
  });
});

describe("resolveProductIcon", () => {
  it("usa el icono del producto, luego el del tipo y si no hay, nada", () => {
    expect(resolveProductIcon({ icon: "taco", product_type: { icon: "cup" } })).toBe("taco");
    expect(resolveProductIcon({ icon: null, product_type: { icon: "cup" } })).toBe("cup");
    expect(resolveProductIcon({ icon: null, type_icon: "gear" })).toBe("gear");
    expect(resolveProductIcon({ icon: null, product_type: null })).toBeNull();
    expect(resolveProductIcon(null)).toBeNull();
  });

  it("ignora una clave desconocida y cae al respaldo", () => {
    expect(resolveProductIcon({ icon: "futuro", product_type: { icon: "cup" } })).toBe("cup");
    expect(resolveProductIcon({ icon: "futuro", type_icon: "viejo" })).toBeNull();
  });
});
