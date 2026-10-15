import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeSwatch } from "./theme-swatch";

describe("ThemeSwatch", () => {
  it("pinta una mitad clara y otra oscura con el tema pedido", () => {
    const { container } = render(<ThemeSwatch theme="talavera" light="Claro" dark="Oscuro" />);
    const halves = container.querySelectorAll("[data-theme]");
    expect(halves).toHaveLength(2);
    expect(halves[0]).toHaveAttribute("data-theme", "talavera");
    expect(halves[0]).toHaveAttribute("data-mode", "light");
    expect(halves[1]).toHaveAttribute("data-theme", "talavera");
    expect(halves[1]).toHaveAttribute("data-mode", "dark");
  });

  it("muestra la etiqueta de cada mitad", () => {
    const { container } = render(<ThemeSwatch theme="grafito" light="Claro" dark="Oscuro" />);
    const halves = container.querySelectorAll("[data-theme]");
    expect(halves[0]).toHaveTextContent("Claro");
    expect(halves[1]).toHaveTextContent("Oscuro");
  });

  it("queda oculta para lectores de pantalla", () => {
    const { container } = render(<ThemeSwatch theme="anaquel" light="a" dark="b" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
