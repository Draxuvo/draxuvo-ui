import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("une clases y descarta valores falsos", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("resuelve conflictos de Tailwind dejando la última clase", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("acepta objetos y arreglos condicionales", () => {
    expect(cn(["a", { b: true, c: false }])).toBe("a b");
  });
});
