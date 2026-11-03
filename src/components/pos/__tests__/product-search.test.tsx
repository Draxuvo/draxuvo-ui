import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { SaleCatalogProduct } from "@/types";

vi.mock("@/services/sales", () => ({ salesService: { catalog: vi.fn() } }));
import { salesService } from "@/services/sales";
import { ProductSearch } from "../product-search";

const product = (over: Partial<SaleCatalogProduct>): SaleCatalogProduct => ({
  id: 1, name: "Cuaderno profesional", sku: "PAP-001", price: "42.50", icon: null, category: "Papelería", stock: 18, fractional: false,
  barcodes: [], ...over,
});

const page = (results: SaleCatalogProduct[]) => ({ info: { page_size: 24, page_index: 1, total: results.length, total_pages: 1 }, results });

beforeEach(() => {
  vi.mocked(salesService.catalog).mockResolvedValue(page([product({}), product({ id: 2, name: "Pluma azul", sku: "PAP-002", price: "9.00", stock: 0 })]) as never);
});

describe("búsqueda de la caja (spec 050)", () => {
  it("lista el catálogo con precio y existencia", async () => {
    renderWithProviders(<ProductSearch onScan={vi.fn()} onPick={vi.fn()} />);
    expect(await screen.findByText("Cuaderno profesional")).toBeInTheDocument();
    expect(screen.getByText("$42.50")).toBeInTheDocument();
    expect(screen.getByText("18 en existencia")).toBeInTheDocument();
    expect(screen.getByText("Sin existencia")).toBeInTheDocument();
  });

  it("tocar una tarjeta elige el producto", async () => {
    const onPick = vi.fn();
    renderWithProviders(<ProductSearch onScan={vi.fn()} onPick={onPick} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /Pluma azul/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it("escanear manda el código y deja el foco en el campo", async () => {
    const onScan = vi.fn();
    renderWithProviders(<ProductSearch onScan={onScan} onPick={vi.fn()} />);
    const field = screen.getByLabelText("Código de barras");
    await userEvent.setup().type(field, "7509990000011{Enter}");
    expect(onScan).toHaveBeenCalledWith("7509990000011");
    expect(field).toHaveFocus();
  });

  it("escribir en el buscador pide el catálogo con ese texto", async () => {
    renderWithProviders(<ProductSearch onScan={vi.fn()} onPick={vi.fn()} />);
    await screen.findByText("Cuaderno profesional");
    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Buscar producto" }), "pluma");
    expect(salesService.catalog).toHaveBeenLastCalledWith({ search: "pluma" });
  });

  it("sin coincidencias lo dice", async () => {
    vi.mocked(salesService.catalog).mockResolvedValue(page([]) as never);
    renderWithProviders(<ProductSearch onScan={vi.fn()} onPick={vi.fn()} />);
    expect(await screen.findByText("Ningún producto coincide.")).toBeInTheDocument();
  });

  it("un error del catálogo se muestra en pantalla", async () => {
    vi.mocked(salesService.catalog).mockRejectedValue(new Error("falló"));
    renderWithProviders(<ProductSearch onScan={vi.fn()} onPick={vi.fn()} />);
    expect(await screen.findByText("No se pudo cargar el catálogo.")).toBeInTheDocument();
  });

  it("desactivado no deja elegir productos", async () => {
    renderWithProviders(<ProductSearch onScan={vi.fn()} onPick={vi.fn()} disabled />);
    expect(await screen.findByRole("button", { name: /Cuaderno profesional/ })).toBeDisabled();
  });
});
