import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ProductSelectionBar } from "../product-selection-bar";

describe("ProductSelectionBar (spec 035)", () => {
  it("no aparece sin selección", () => {
    renderWithProviders(<ProductSelectionBar count={0} onGenerate={vi.fn()} onPrint={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("muestra el contador y dispara cada acción", async () => {
    const onGenerate = vi.fn();
    const onPrint = vi.fn();
    const onClear = vi.fn();
    renderWithProviders(<ProductSelectionBar count={3} onGenerate={onGenerate} onPrint={onPrint} onClear={onClear} />);
    const user = userEvent.setup();

    expect(screen.getByText("3 seleccionados")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Generar códigos" }));
    await user.click(screen.getByRole("button", { name: "Imprimir etiquetas" }));
    await user.click(screen.getByRole("button", { name: "Limpiar" }));

    expect([onGenerate, onPrint, onClear].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it("singular con uno", () => {
    renderWithProviders(<ProductSelectionBar count={1} onGenerate={vi.fn()} onPrint={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();
  });
});
