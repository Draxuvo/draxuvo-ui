import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { saveLabelSelection } from "@/hooks/use-label-selection";
import type { LabelFormat } from "@/types";

vi.mock("@/services/inventory", () => ({
  inventoryService: {
    labelFormats: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    labels: { check: vi.fn(), pdf: vi.fn() },
    generateProductBarcodes: vi.fn(),
  },
}));

import { inventoryService } from "@/services/inventory";
import { LabelsScreen } from "../labels-screen";

const format = (over: Partial<LabelFormat>): LabelFormat => ({
  id: "std:a4-65", name: "A4 · 65 etiquetas", custom: false, kind: "sheet", page_width_mm: 210, page_height_mm: 297, columns: 5, rows: 13,
  label_width_mm: 38, label_height_mm: 21.2, margin_top_mm: 10, margin_left_mm: 4.7, gap_x_mm: 2.5, gap_y_mm: 0, labels_per_page: 65, small: true, ...over,
});
const big = format({ id: "std:roll-50x25", name: "Rollo 50 × 25", kind: "roll", labels_per_page: 1, label_width_mm: 50, label_height_mm: 25, small: false });
const item = (id: number, over = {}) => ({ id, name: `P${id}`, copies: 1, barcodes: [`7500000000${id}`], stock: 4, fractional: false, price: 10, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.mocked(inventoryService.labelFormats.list).mockResolvedValue([format({}), big]);
  vi.mocked(inventoryService.labels.check).mockResolvedValue({ check: { labels_count: 1, pages: 1, warnings: [], skipped: [] } });
  vi.mocked(inventoryService.labels.pdf).mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

describe("LabelsScreen (spec 035)", () => {
  it("sin selección muestra el vacío con enlace al inventario", async () => {
    renderWithProviders(<LabelsScreen />);
    expect(await screen.findByText("No hay productos para etiquetar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inventario" })).toBeInTheDocument();
  });

  it("en un formato chico Nombre y Precio nacen apagados", async () => {
    saveLabelSelection([item(1)]);
    renderWithProviders(<LabelsScreen />);
    expect(await screen.findByText(/Etiqueta pequeña/)).toBeInTheDocument();
    expect(screen.getByLabelText("Imprimir el nombre")).not.toBeChecked();
    expect(screen.getByLabelText("Imprimir el precio")).not.toBeChecked();
  });

  it("una por unidad en existencia llena las copias con el redondeo hacia arriba", async () => {
    saveLabelSelection([item(1, { stock: 2.5 }), item(2, { stock: null }), item(3, { stock: 0 })]);
    renderWithProviders(<LabelsScreen />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Una por unidad en existencia" }));
    expect(screen.getByText("5 etiquetas en total")).toBeInTheDocument();
  });

  it("con productos sin código ofrece generarlos y no pide vista previa", async () => {
    saveLabelSelection([item(1, { barcodes: [] })]);
    vi.mocked(inventoryService.generateProductBarcodes).mockResolvedValue({
      generated: 1, already_had: 0, failed: [], products: [{ id: 1, barcodes: ["2900000000013"] } as never],
    });
    renderWithProviders(<LabelsScreen />);
    const user = userEvent.setup();
    expect(await screen.findByText("Hay productos sin código de barras.")).toBeInTheDocument();
    expect(inventoryService.labels.check).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Generar códigos faltantes" }));
    await waitFor(() => expect(inventoryService.generateProductBarcodes).toHaveBeenCalledWith([1]));
    await waitFor(() => expect(screen.queryByText("Hay productos sin código de barras.")).not.toBeInTheDocument());
  });

  it("pide la vista previa con el formato y las opciones elegidas", async () => {
    saveLabelSelection([item(1, { copies: 2 })]);
    renderWithProviders(<LabelsScreen />);
    const user = userEvent.setup();
    await screen.findByText(/Etiqueta pequeña/);
    await user.click(screen.getByLabelText("Imprimir el nombre"));
    await waitFor(() => expect(inventoryService.labels.check).toHaveBeenCalled(), { timeout: 3000 });
    expect(vi.mocked(inventoryService.labels.check).mock.calls.at(-1)![0]).toMatchObject({
      format_id: "std:a4-65", show_name: true, show_price: false, start_position: 1, items: [{ product_id: 1, copies: 2 }],
    });
    expect(await screen.findByRole("link", { name: /Descargar PDF/ }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("los avisos de la vista previa salen junto al producto afectado", async () => {
    saveLabelSelection([item(1)]);
    vi.mocked(inventoryService.labels.check).mockResolvedValue({
      check: { labels_count: 1, pages: 1, skipped: [], warnings: [{ product_id: 1, code: "content_too_big", message: "No cabe el nombre" }] },
    });
    renderWithProviders(<LabelsScreen />);
    const alert = await screen.findByRole("alert", { name: "Avisos" }, { timeout: 3000 });
    expect(alert).toHaveTextContent("P1: No cabe el nombre");
  });

  it("una por unidad respeta el tope de 1,000 y avisa", async () => {
    saveLabelSelection([item(1, { stock: 900 }), item(2, { stock: 900 })]);
    renderWithProviders(<LabelsScreen />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Una por unidad en existencia" }));
    expect(screen.getByText("Se limitó a 1000 etiquetas por PDF.")).toBeInTheDocument();
    expect(screen.getByText(/etiquetas en total/)).toHaveTextContent(/^(1000|1,000|999) etiquetas en total$/);
  });
});
