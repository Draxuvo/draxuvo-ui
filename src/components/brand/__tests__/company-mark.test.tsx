import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { CompanyMark } from "../company-mark";

describe("CompanyMark (spec 063)", () => {
  it("muestra el logo de la empresa con su nombre", () => {
    renderWithProviders(<CompanyMark name="Aquí me quedo" logoUrl="https://api.test/logo.webp" expanded />);
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "https://api.test/logo.webp");
    expect(screen.getByText("Aquí me quedo")).toBeInTheDocument();
    expect(screen.queryByText(/draxuvo/i)).not.toBeInTheDocument();
  });

  it("sin logo muestra el distintivo con la inicial, nunca la marca Draxuvo", () => {
    renderWithProviders(<CompanyMark name="aquí me quedo" logoUrl={null} />);
    expect(screen.getByRole("img", { name: "aquí me quedo" })).toHaveTextContent("A");
    expect(screen.queryByText(/draxuvo/i)).not.toBeInTheDocument();
  });

  it("si la imagen no carga cae al distintivo", () => {
    renderWithProviders(<CompanyMark name="Volta" logoUrl="https://api.test/roto.webp" />);
    fireEvent.error(screen.getByRole("img", { name: "Volta" }));
    expect(screen.getByRole("img", { name: "Volta" })).toHaveTextContent("V");
    expect(screen.getByRole("img", { name: "Volta" }).tagName).toBe("SPAN");
  });

  it("vuelve a intentar con otro logo después de una falla", () => {
    const { rerender } = renderWithProviders(<CompanyMark name="Volta" logoUrl="https://api.test/roto.webp" />);
    fireEvent.error(screen.getByRole("img", { name: "Volta" }));
    rerender(<CompanyMark name="Volta" logoUrl="https://api.test/nuevo.webp" />);
    expect(screen.getByRole("img", { name: "Volta" }).tagName).toBe("IMG");
  });

  it("un nombre largo se recorta en vez de romper el espacio", () => {
    renderWithProviders(<CompanyMark name={"Restaurante ".repeat(10)} logoUrl={null} expanded />);
    expect(screen.getByText(/Restaurante/)).toHaveClass("truncate");
  });
});
