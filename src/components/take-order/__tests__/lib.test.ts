import { describe, expect, it } from "vitest";
import {
  categoryColor, closedChecksOf, filterMenu, matchesCheckFilter, inOrderCount, normalize, openChecksOf, runningTotal, screenMode, tapProduct, type Line,
} from "../lib";

const line = (over: Partial<Line> = {}): Line => ({
  id: 1, product_id: 10, name: "Tostada", quantity: 1, unit_price: 30, editable: true, sent: false, ...over,
});

describe("screenMode", () => {
  it("usa cuentas de mesa con el módulo de restaurante", () => {
    expect(screenMode(["restaurant", "work_orders"], "service")).toBe("restaurant");
  });
  it("usa órdenes sin restaurante y en modo pedido", () => {
    expect(screenMode(["work_orders"], "order")).toBe("orders");
  });
  it("no aplica en modo servicio sin restaurante", () => {
    expect(screenMode(["work_orders"], "service")).toBe("none");
  });
});

describe("normalize y filterMenu", () => {
  const menu = [
    { category: "Antojitos", items: [{ id: 1, name: "Tostada de camarón", price: 30 }, { id: 2, name: "Sope", price: 25 }] },
    { category: "Bebidas", items: [{ id: 3, name: "Café", price: 20 }] },
  ];
  it("quita acentos y mayúsculas", () => expect(normalize("  CAFÉ ")).toBe("cafe"));
  it("filtra sin acentos y descarta grupos vacíos", () => {
    expect(filterMenu(menu, "CAMARON")).toEqual([{ category: "Antojitos", items: [menu[0].items[0]] }]);
    expect(filterMenu(menu, "cafe").map((s) => s.category)).toEqual(["Bebidas"]);
  });
  it("sin término devuelve todo", () => expect(filterMenu(menu, " ")).toBe(menu));
});

describe("tapProduct", () => {
  it("sube el renglón editable del producto", () => {
    const l = line();
    expect(tapProduct([l], { id: 10, name: "Tostada" })).toEqual({ kind: "increment", line: l });
  });
  it("agrega si no hay renglón, si ya se mandó o si lleva nota", () => {
    expect(tapProduct([], { id: 10, name: "Tostada" })).toEqual({ kind: "add" });
    expect(tapProduct([line({ editable: false, sent: true })], { id: 10, name: "Tostada" })).toEqual({ kind: "add" });
    expect(tapProduct([line({ note: "sin cebolla" })], { id: 10, name: "Tostada" })).toEqual({ kind: "add" });
  });
});

describe("runningTotal e inOrderCount", () => {
  it("suma los renglones no cancelados", () => {
    expect(runningTotal([line({ quantity: 2 }), line({ id: 2, unit_price: 10.1 }), line({ id: 3, cancelled: true })])).toBe(70.1);
  });
  it("cuenta solo lo editable del producto", () => {
    expect(inOrderCount([line({ quantity: 2 }), line({ id: 2, editable: false })], { id: 10, name: "Tostada" })).toBe(2);
  });
  it("en una cuenta compara por nombre porque el renglón no trae el producto", () => {
    expect(inOrderCount([line({ product_id: null, quantity: 3 })], { id: 99, name: "Tostada" })).toBe(3);
  });
});

describe("categoryColor", () => {
  it("es estable", () => expect(categoryColor("Bebidas")).toBe(categoryColor("Bebidas")));
  it("usa la paleta de gráficas", () => expect(categoryColor("x")).toMatch(/^var\(--chart-[1-5]\)$/));
});

describe("openChecksOf", () => {
  const waiter = { id: 1, name: "Ana" };
  const overview = {
    results: [
      { name: "1", check: { id: 10, waiter, opened_at: "2026-10-21T10:00:00Z", total: "90.00", mine: true } },
      { name: "2", check: { id: 11, waiter: { id: 2, name: "Luis" }, opened_at: "2026-10-21T10:05:00Z", total: "40.50", mine: false } },
      { name: "3", check: null },
    ],
    takeouts: [{ id: 12, takeout_name: "Mario", waiter, opened_at: "2026-10-21T10:10:00Z", total: "20.00", mine: true }],
  };

  it("une mesas y para llevar, sin las mesas libres", () => {
    const all = openChecksOf(overview, "all");
    expect(all.map((c) => [c.id, c.name, c.takeout])).toEqual([[10, "1", false], [11, "2", false], [12, "Mario", true]]);
    expect(all[1].total).toBe(40.5);
  });
  it("con scope mine solo trae las propias", () => {
    expect(openChecksOf(overview, "mine").map((c) => c.id)).toEqual([10, 12]);
  });
  it("sin datos devuelve lista vacía", () => expect(openChecksOf(undefined, "all")).toEqual([]));
});

describe("closedChecksOf", () => {
  const closed_today = [
    { id: 20, name: "2", takeout_name: null, closed_at: "2026-10-21T12:00:00Z", waiter: { id: 1, name: "Ana" }, total: "380.00", mine: true },
    { id: 21, name: null, takeout_name: "Mario", closed_at: "2026-10-21T11:00:00Z", mine: false },
  ];

  it("lista mesas y para llevar; sin total ni mesero en las ajenas", () => {
    const all = closedChecksOf({ closed_today }, "all");
    expect(all.map((c) => [c.id, c.name, c.takeout, c.total, c.waiter])).toEqual([[20, "2", false, 380, "Ana"], [21, "Mario", true, null, null]]);
  });
  it("con scope mine solo trae las propias", () => {
    expect(closedChecksOf({ closed_today }, "mine").map((c) => c.id)).toEqual([20]);
  });
  it("sin datos devuelve lista vacía", () => {
    expect(closedChecksOf(undefined, "all")).toEqual([]);
    expect(closedChecksOf({}, "all")).toEqual([]);
  });
});

describe("matchesCheckFilter", () => {
  const check = { name: "Mesa 2", waiter: "Ana", waiterId: 1 };
  const any = { status: "", userId: null, search: "" };

  it("sin filtros deja pasar todo", () => {
    expect(matchesCheckFilter(check, "open", any)).toBe(true);
    expect(matchesCheckFilter(check, "paid", any)).toBe(true);
  });
  it("las fichas de estado llevan cada grupo: Terminada a Por cobrar, Abierta a Abiertas, Cobrada a Cobradas", () => {
    expect(matchesCheckFilter(check, "to_pay", { ...any, status: "done" })).toBe(true);
    expect(matchesCheckFilter(check, "open", { ...any, status: "done" })).toBe(false);
    expect(matchesCheckFilter(check, "open", { ...any, status: "open" })).toBe(true);
    expect(matchesCheckFilter(check, "paid", { ...any, status: "paid" })).toBe(true);
    expect(matchesCheckFilter(check, "open", { ...any, status: "paid" })).toBe(false);
    expect(matchesCheckFilter(check, "open", { ...any, status: "in_progress" })).toBe(false);
    expect(matchesCheckFilter(check, "paid", { ...any, status: "cancelled" })).toBe(false);
  });
  it("el responsable se compara con el mesero de la cuenta", () => {
    expect(matchesCheckFilter(check, "open", { ...any, userId: 1 })).toBe(true);
    expect(matchesCheckFilter(check, "open", { ...any, userId: 2 })).toBe(false);
    expect(matchesCheckFilter({ ...check, waiterId: null }, "open", { ...any, userId: 1 })).toBe(false);
  });
  it("la búsqueda ignora acentos y mayúsculas y mira mesa y mesero", () => {
    expect(matchesCheckFilter(check, "open", { ...any, search: "mesa 2" })).toBe(true);
    expect(matchesCheckFilter(check, "open", { ...any, search: "ANA" })).toBe(true);
    expect(matchesCheckFilter(check, "open", { ...any, search: "luis" })).toBe(false);
  });
});
