import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { MenuGrid } from "../menu-grid";
import { OrderPanel } from "../order-panel";
import { TablePlan } from "../table-plan";
import type { Line, MenuSection } from "../lib";
import type { CurrentOrder, SourceTile } from "../use-order-source";

const tile = (over: Partial<SourceTile> = {}): SourceTile => ({
  key: "table:1", name: "4", state: "free", total: 0, owner: null, mine: false, selection: null, tableId: 1, ...over,
});

describe("TablePlan", () => {
  const base = { mode: "restaurant" as const, selection: null, loading: false, error: false };

  it("muestra el estado en texto y el total de las ocupadas", () => {
    renderWithProviders(
      <TablePlan
        {...base}
        tiles={[tile(), tile({ key: "table:2", name: "5", state: "occupied", total: 320, owner: "Ana", selection: { kind: "check", id: 9 } })]}
        onPick={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^Mesa 4, Libre/ })).toBeInTheDocument();
    const busy = screen.getByRole("button", { name: /^Mesa 5, Ocupada, .*320/ });
    expect(within(busy).getByText("Ana", { exact: false })).toBeInTheDocument();
  });

  it("avisa al tocar una mesa y crea una cuenta para llevar con nombre", async () => {
    const onPick = vi.fn();
    const onCreate = vi.fn();
    renderWithProviders(<TablePlan {...base} tiles={[tile()]} onPick={onPick} onCreate={onCreate} />);
    await userEvent.click(screen.getByRole("button", { name: /^Mesa 4, Libre/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: "4" }));

    await userEvent.click(screen.getByRole("button", { name: /Para llevar/ }));
    await userEvent.type(screen.getByLabelText("Nombre del cliente"), "Luis");
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(onCreate).toHaveBeenCalledWith("Luis");
  });

  it("cada mesa muestra su estado, el tiempo abierta y el total sin elegirla", () => {
    const opened = new Date(Date.now() - 25 * 60_000).toISOString();
    renderWithProviders(
      <TablePlan
        {...base}
        tiles={[tile({ key: "table:2", name: "5", state: "to_pay", total: 320, owner: "Ana", openedAt: opened, selection: { kind: "check", id: 9 } })]}
        onPick={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    const busy = screen.getByRole("button", { name: /^Mesa 5, Por cobrar, 25 min abierta, \$320\.00, Ana/ });
    expect(within(busy).getByText("Por cobrar")).toBeInTheDocument();
    expect(within(busy).getByText("25 min")).toBeInTheDocument();
  });

  it("una cuenta ajena sin total no inventa dinero", () => {
    renderWithProviders(
      <TablePlan {...base} tiles={[tile({ name: "7", state: "occupied", total: null, openedAt: new Date().toISOString(), selection: { kind: "check", id: 3 } })]} onPick={vi.fn()} onCreate={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /^Mesa 7, Ocupada/ }).textContent).not.toMatch(/\$/);
  });

  it("Mis mesas deja las propias y las libres, y avisa si no hay cuentas propias", async () => {
    const tiles = [
      tile({ key: "table:1", name: "1" }),
      tile({ key: "table:2", name: "2", state: "occupied", total: 90, mine: true, owner: "Ana", openedAt: new Date().toISOString(), selection: { kind: "check", id: 2 } }),
      tile({ key: "table:3", name: "3", state: "occupied", total: 50, mine: false, owner: "Luis", openedAt: new Date().toISOString(), selection: { kind: "check", id: 3 } }),
    ];
    const { rerender } = renderWithProviders(<TablePlan {...base} tiles={tiles} onPick={vi.fn()} onCreate={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Mis mesas" }));
    expect(screen.getByRole("button", { name: /^Mesa 1, Libre/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Mesa 2, Ocupada/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mesa 3/ })).not.toBeInTheDocument();

    rerender(<TablePlan {...base} tiles={[tiles[0], tiles[2]]} onPick={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText(/Todavía no tienes cuentas abiertas/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(screen.getByRole("button", { name: /^Mesa 3, Ocupada/ })).toBeInTheDocument();
  });

  it("en modo órdenes no hay filtro de Mis mesas", () => {
    renderWithProviders(<TablePlan {...base} mode="orders" tiles={[tile()]} onPick={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Mis mesas" })).not.toBeInTheDocument();
  });
});

describe("MenuGrid", () => {
  const menu: MenuSection[] = [
    { category: "Antojitos", items: [{ id: 1, name: "Tostada de camarón", price: 30 }, { id: 2, name: "Sope", price: 25, sold_out: true }] },
    { category: "Bebidas", items: [{ id: 3, name: "Café", price: 20, low: true }] },
  ];
  const props = { menu, loading: false, error: false, disabled: false, countOf: (c: { id: number }) => (c.id === 3 ? 2 : 0) };

  it("filtra sin acentos ni mayúsculas", async () => {
    renderWithProviders(<MenuGrid {...props} onTap={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Buscar producto"), "CAMARON");
    expect(screen.getByRole("button", { name: /Tostada de camarón/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Café/ })).not.toBeInTheDocument();
  });

  it("agrega al tocar, muestra el contador y no deja agregar lo agotado", async () => {
    const onTap = vi.fn();
    renderWithProviders(<MenuGrid {...props} onTap={onTap} />);
    await userEvent.click(screen.getByRole("button", { name: /Tostada de camarón/ }));
    expect(onTap).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(screen.getByRole("button", { name: /Sope/ })).toBeDisabled();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByText("Quedan pocas")).toBeInTheDocument();
    expect(screen.getByLabelText("2 en la orden")).toBeInTheDocument();
  });
});

describe("MenuGrid: iconos (spec 026)", () => {
  const menu: MenuSection[] = [
    {
      category: "Antojitos",
      items: [
        { id: 1, name: "Taco", price: 30, icon: "taco" },
        { id: 2, name: "Sope", price: 25, product_type: { icon: "utensils" } },
        { id: 3, name: "Gordita", price: 25 },
      ],
    },
  ];
  const props = { menu, loading: false, error: false, disabled: false, countOf: () => 0, onTap: vi.fn() };

  it("pinta el icono propio, el del tipo o la inicial, sin cambiar el nombre accesible", () => {
    renderWithProviders(<MenuGrid {...props} />);
    const taco = screen.getByRole("button", { name: /^Taco/ });
    expect(taco.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^Sope/ }).querySelector("svg")).not.toBeNull();
    const gordita = screen.getByRole("button", { name: /^Gordita/ });
    expect(gordita.querySelector("svg")).toBeNull();
    expect(within(gordita).getByText("G")).toBeInTheDocument();
  });
});

describe("OrderPanel", () => {
  const line = (over: Partial<Line> = {}): Line => ({
    id: 1, product_id: null, name: "Tostada", quantity: 2, unit_price: 30, editable: true, sent: false, ...over,
  });
  const current = (lines: Line[], over: Partial<CurrentOrder> = {}): CurrentOrder => ({
    selection: { kind: "check", id: 9 }, title: "4", lines, total: 60, canAdd: true, canSend: true, canCharge: true, canRelease: false, ...over,
  });
  const handlers = { onQuantity: vi.fn(), onRemove: vi.fn(), onNote: vi.fn(), onSend: vi.fn(), onCharge: vi.fn(), onRelease: vi.fn() };

  it("sube, baja y quita un renglón", async () => {
    const l = line();
    renderWithProviders(<OrderPanel current={current([l])} loading={false} missing={false} canNote sending={false} {...handlers} />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar una unidad de Tostada" }));
    expect(handlers.onQuantity).toHaveBeenCalledWith(l, 3);
    await userEvent.click(screen.getByRole("button", { name: "Quitar una unidad de Tostada" }));
    expect(handlers.onQuantity).toHaveBeenCalledWith(l, 1);
    await userEvent.click(screen.getByRole("button", { name: "Quitar Tostada" }));
    expect(handlers.onRemove).toHaveBeenCalledWith(l);
  });

  it("deja lo ya mandado sin controles y ofrece mandar y cobrar", async () => {
    renderWithProviders(
      <OrderPanel
        current={current([line(), line({ id: 2, name: "Sope", editable: false, sent: true })])}
        loading={false} missing={false} canNote sending={false} {...handlers}
      />,
    );
    expect(screen.getByText("Ya mandado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar Sope" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mandar" }));
    await userEvent.click(screen.getByRole("button", { name: "Cobrar" }));
    expect(handlers.onSend).toHaveBeenCalled();
    expect(handlers.onCharge).toHaveBeenCalled();
  });

  it("ofrece Liberar mesa solo cuando la API permite cancelar la cuenta", async () => {
    const { rerender } = renderWithProviders(
      <OrderPanel current={current([], { canRelease: true })} loading={false} missing={false} canNote sending={false} {...handlers} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Liberar mesa" }));
    expect(handlers.onRelease).toHaveBeenCalled();

    rerender(<OrderPanel current={current([], { canRelease: false })} loading={false} missing={false} canNote sending={false} {...handlers} />);
    expect(screen.queryByRole("button", { name: "Liberar mesa" })).not.toBeInTheDocument();
  });

  it("pide elegir una mesa cuando no hay orden", () => {
    renderWithProviders(<OrderPanel current={null} loading={false} missing={false} canNote sending={false} {...handlers} />);
    expect(screen.getByText("Elige una mesa para ver su orden.")).toBeInTheDocument();
  });
});
