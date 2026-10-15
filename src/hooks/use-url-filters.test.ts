import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/es/ordenes",
  useSearchParams: () => new URLSearchParams(search),
}));

import { useUrlFilters } from "./use-url-filters";

const defaults = { status: "all", q: "" };
const allowed = { status: ["all", "open", "done"] } as const;

function setup(opts: Parameters<typeof useUrlFilters<"status" | "q">>[1] = { allowed }) {
  return renderHook(() => useUrlFilters<"status" | "q">(defaults, opts)).result;
}

beforeEach(() => {
  replace.mockClear();
  search = "";
});

describe("useUrlFilters lectura", () => {
  it("sin query usa los defaults, página 1 y no está filtrado", () => {
    const r = setup();
    expect(r.current.filters).toEqual(defaults);
    expect(r.current.page).toBe(1);
    expect(r.current.isFiltered).toBe(false);
  });

  it("lee filtros de la URL y recorta espacios", () => {
    search = "status=open&q=%20hola%20";
    const r = setup();
    expect(r.current.filters).toEqual({ status: "open", q: "hola" });
    expect(r.current.isFiltered).toBe(true);
  });

  it("trata un valor fuera de los permitidos como ausente", () => {
    search = "status=hack";
    const r = setup();
    expect(r.current.filters.status).toBe("all");
    expect(r.current.isFiltered).toBe(false);
  });

  it("sin lista de permitidos acepta cualquier valor no vacío", () => {
    search = "status=cualquiera";
    expect(setup({}).current.filters.status).toBe("cualquiera");
  });

  it("lee la página válida", () => {
    search = "page=3";
    expect(setup().current.page).toBe(3);
  });

  it.each(["0", "-2", "1.5", "abc", ""])("la página %j inválida cae en 1", (raw) => {
    search = `page=${raw}`;
    expect(setup().current.page).toBe(1);
  });
});

describe("useUrlFilters escritura", () => {
  it("setFilter escribe el valor, usa scroll:false y quita page", () => {
    search = "page=4";
    setup().current.setFilter("status", "open");
    expect(replace).toHaveBeenCalledWith("/es/ordenes?status=open", { scroll: false });
  });

  it("no escribe un valor igual al default", () => {
    search = "status=open";
    setup().current.setFilter("status", "all");
    expect(replace).toHaveBeenCalledWith("/es/ordenes", { scroll: false });
  });

  it("null, vacío o valor no permitido eliminan el parámetro", () => {
    search = "status=open&q=x";
    const r = setup();
    r.current.setFilter("q", null);
    expect(replace).toHaveBeenLastCalledWith("/es/ordenes?status=open", { scroll: false });
    r.current.setFilter("status", "otro");
    expect(replace).toHaveBeenLastCalledWith("/es/ordenes?q=x", { scroll: false });
    r.current.setFilter("q", "   ");
    expect(replace).toHaveBeenLastCalledWith("/es/ordenes?status=open", { scroll: false });
  });

  it("setFilters aplica varios cambios a la vez", () => {
    setup().current.setFilters({ status: "done", q: "luz" });
    expect(replace).toHaveBeenCalledWith("/es/ordenes?status=done&q=luz", { scroll: false });
  });

  it("setPage escribe la página y conserva los filtros", () => {
    search = "status=open";
    setup().current.setPage(2);
    expect(replace).toHaveBeenCalledWith("/es/ordenes?status=open&page=2", { scroll: false });
  });

  it("setPage(1), valores menores o no enteros quitan page", () => {
    search = "page=3";
    const r = setup();
    for (const p of [1, 0, -1, 2.5]) {
      r.current.setPage(p);
      expect(replace).toHaveBeenLastCalledWith("/es/ordenes", { scroll: false });
    }
  });

  it("reset navega a la ruta sin query", () => {
    search = "status=open&q=x&page=2";
    setup().current.reset();
    expect(replace).toHaveBeenCalledWith("/es/ordenes", { scroll: false });
  });
});
