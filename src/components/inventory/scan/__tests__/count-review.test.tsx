import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Product, StockCountItem } from "@/types";
import { CountReview } from "../count-review";

const item = (id: number, name: string, over: Partial<StockCountItem> = {}): StockCountItem => ({
  product: { id, sku: `S-${id}`, name } as Product,
  counted_qty: 5, baseline_stock: 5, current_stock: 5, difference: 0, changed: false, ...over,
});

describe("CountReview (spec 034)", () => {
  it("muestra sobrantes, faltantes y filas sin diferencia en texto", () => {
    renderWithProviders(
      <CountReview
        confirming={false}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        items={[
          item(1, "Cuaderno", { counted_qty: 8, current_stock: 5, difference: 3 }),
          item(2, "Lápiz", { counted_qty: 1, current_stock: 4, difference: -3 }),
          item(3, "Goma"),
        ]}
      />,
    );

    expect(screen.getByText("Sobran 3")).toBeInTheDocument();
    expect(screen.getByText("Faltan 3")).toBeInTheDocument();
    expect(screen.getByText("Sin diferencia")).toBeInTheDocument();
    expect(screen.getByText(/2 productos con diferencia/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("avisa cuando el stock cambió mientras se contaba", () => {
    renderWithProviders(
      <CountReview confirming={false} onBack={vi.fn()} onConfirm={vi.fn()} items={[item(1, "Cuaderno", { changed: true, current_stock: 9, difference: -4 })]} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("cambió mientras contabas");
    expect(screen.getByText("Cambió")).toBeInTheDocument();
  });

  it("exige confirmación explícita antes de ajustar", async () => {
    const onConfirm = vi.fn();
    renderWithProviders(<CountReview confirming={false} onBack={vi.fn()} onConfirm={onConfirm} items={[item(1, "Cuaderno", { difference: 2, counted_qty: 7 })]} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    expect(onConfirm).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("1 producto");
    await user.click(within(dialog).getByRole("button", { name: "Ajustar stock" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("seguir contando regresa sin confirmar", async () => {
    const onBack = vi.fn();
    renderWithProviders(<CountReview confirming={false} onBack={onBack} onConfirm={vi.fn()} items={[item(1, "Cuaderno")]} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Seguir contando" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
