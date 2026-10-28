import { describe, expect, it } from "vitest";
import { compact, duplicates, parseChoices, pickAlert, resolve } from "./choices";

describe("parseChoices", () => {
  it("devuelve vacío con JSON inválido o de otro tipo", () => {
    expect(parseChoices(null)).toEqual({});
    expect(parseChoices("{")).toEqual({});
    expect(parseChoices("[]")).toEqual({});
    expect(parseChoices('"campana"')).toEqual({});
  });

  it("descarta alertas desconocidas y sonidos fuera del catálogo", () => {
    expect(parseChoices('{"ready":"campana","urgent":"nope","otra":"gota"}')).toEqual({ ready: "campana" });
  });
});

describe("resolve", () => {
  it("usa el valor por omisión sin elección o con un id inexistente", () => {
    expect(resolve("new_kitchen", {})).toBe("cocina");
    expect(resolve("new_bar", { new_bar: "nope" as never })).toBe("barra");
  });

  it("usa la elección cuando existe", () => {
    expect(resolve("ready", { ready: "marimba" })).toBe("marimba");
  });
});

describe("pickAlert", () => {
  it("prefiere atrasada sobre nueva y nueva sobre lista", () => {
    expect(pickAlert(["ready", "new_bar", "urgent"])).toBe("urgent");
    expect(pickAlert(["ready", "new_bar"])).toBe("new_bar");
    expect(pickAlert(["ready"])).toBe("ready");
    expect(pickAlert([])).toBeUndefined();
  });
});

describe("duplicates", () => {
  const all = ["new_kitchen", "new_bar", "new_other", "urgent", "ready"] as const;

  it("no marca nada con los valores por omisión", () => {
    expect(duplicates({}, all)).toEqual([]);
  });

  it("marca las alertas que comparten sonido", () => {
    expect(duplicates({ new_bar: "cocina" }, all)).toEqual(["new_kitchen", "new_bar"]);
    expect(duplicates({ new_bar: "campana", new_other: "campana", ready: "campana" }, all).sort()).toEqual(["new_bar", "new_other", "ready"]);
  });
});

describe("compact", () => {
  it("quita lo que coincide con el valor por omisión", () => {
    expect(compact({ new_kitchen: "cocina", ready: "gota" })).toEqual({ ready: "gota" });
  });
});
