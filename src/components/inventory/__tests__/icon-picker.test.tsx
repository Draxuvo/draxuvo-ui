import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { IconPicker } from "../icon-picker";

describe("IconPicker (spec 026)", () => {
  it("busca por nombre, elige un icono y cierra", async () => {
    const onChange = vi.fn();
    renderWithProviders(<IconPicker value={null} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Elegir icono" }));
    await user.type(screen.getByLabelText("Buscar icono"), "CAFE");
    expect(screen.queryByRole("button", { name: "Pizza" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Café" }));
    expect(onChange).toHaveBeenCalledWith("coffee");
    expect(screen.queryByLabelText("Buscar icono")).not.toBeInTheDocument();
  });

  it("agrupa por giro y avisa si no hay resultados", async () => {
    renderWithProviders(<IconPicker value="taco" onChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Cambiar icono" }));
    expect(screen.getByRole("region", { name: "Plomería y oficios" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Taco" })).toHaveAttribute("aria-pressed", "true");
    await user.type(screen.getByLabelText("Buscar icono"), "zzzz");
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("quita el icono propio y muestra el sugerido cuando no hay", async () => {
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(<IconPicker value="taco" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitar icono" }));
    expect(onChange).toHaveBeenCalledWith(null);
    rerender(<IconPicker value={null} onChange={onChange} fallback="cup" />);
    expect(screen.getByText("Sugerido: Vaso")).toBeInTheDocument();
  });
});
