import { describe, expect, it } from "vitest";
import { createDebounce, normalizeCode, pickCentral } from "./lib";

describe("normalizeCode (spec 056)", () => {
  it("recorta espacios y saltos", () => {
    expect(normalizeCode("  7501234567890\n")).toBe("7501234567890");
    expect(normalizeCode("T-000123")).toBe("T-000123");
  });
  it("descarta vacío, muy largo y no imprimible", () => {
    expect(normalizeCode("   ")).toBeNull();
    expect(normalizeCode(null)).toBeNull();
    expect(normalizeCode("a".repeat(129))).toBeNull();
    expect(normalizeCode("café")).toBeNull();
    expect(normalizeCode("a".repeat(128))).toBe("a".repeat(128));
  });
});

describe("createDebounce (spec 056)", () => {
  function clock() {
    let t = 0;
    return { now: () => t, advance: (ms: number) => (t += ms) };
  }

  it("cuenta una vez una lectura sostenida 3 s (SC-004)", () => {
    const c = clock();
    const d = createDebounce({ now: c.now });
    let counted = 0;
    for (let i = 0; i < 30; i += 1) {
      if (d.accept("111")) counted += 1;
      c.advance(100);
    }
    expect(counted).toBe(1);
  });

  it("acepta otro código al instante", () => {
    const c = clock();
    const d = createDebounce({ now: c.now });
    expect(d.accept("111")).toBe(true);
    c.advance(50);
    expect(d.accept("222")).toBe(true);
    c.advance(50);
    expect(d.accept("111")).toBe(true);
  });

  it("vuelve a contar tras salir de cuadro", () => {
    const c = clock();
    const d = createDebounce({ now: c.now });
    expect(d.accept("111")).toBe(true);
    c.advance(1200);
    expect(d.accept("111")).toBe(true);
  });

  it("vuelve a contar si se sostiene más de holdMs", () => {
    const c = clock();
    const d = createDebounce({ now: c.now });
    let counted = 0;
    for (let i = 0; i < 50; i += 1) {
      if (d.accept("111")) counted += 1;
      c.advance(100);
    }
    expect(counted).toBe(2);
  });

  it("reset olvida la última lectura", () => {
    const c = clock();
    const d = createDebounce({ now: c.now });
    d.accept("111");
    d.reset();
    expect(d.accept("111")).toBe(true);
  });
});

describe("pickCentral (spec 056)", () => {
  it("elige el código más cercano al centro", () => {
    const codes = [
      { value: "lejos", center: { x: 10, y: 10 } },
      { value: "centro", center: { x: 330, y: 250 } },
    ];
    expect(pickCentral(codes, 640, 480)?.value).toBe("centro");
  });
  it("sin posiciones toma el primero y sin códigos devuelve null", () => {
    expect(pickCentral([{ value: "a" }, { value: "b" }], 640, 480)?.value).toBe("a");
    expect(pickCentral([], 640, 480)).toBeNull();
  });
});
