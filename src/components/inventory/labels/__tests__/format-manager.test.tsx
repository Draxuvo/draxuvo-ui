import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { LabelFormat } from "@/types";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/services/inventory", () => ({
  inventoryService: { labelFormats: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } },
}));

import { inventoryService } from "@/services/inventory";
import { FormatManager } from "../format-manager";

const base: LabelFormat = {
  id: "std:a4-65", name: "A4 · 65", custom: false, kind: "sheet", page_width_mm: 210, page_height_mm: 297, columns: 5, rows: 13,
  label_width_mm: 38, label_height_mm: 21.2, margin_top_mm: 10, margin_left_mm: 4.7, gap_x_mm: 2.5, gap_y_mm: 0, labels_per_page: 65, small: true,
};
const own: LabelFormat = { ...base, id: 7, name: "Estante", custom: true, labels_per_page: 24, small: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryService.labelFormats.list).mockResolvedValue([base, own]);
});

describe("FormatManager (spec 035)", () => {
  it("solo lista los formatos propios; los comunes no tienen acciones", async () => {
    renderWithProviders(<FormatManager open onOpenChange={vi.fn()} />);
    expect(await screen.findByText("Estante")).toBeInTheDocument();
    expect(screen.queryByText("A4 · 65")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar Estante" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar Estante" })).toBeInTheDocument();
  });

  it("crea un formato propio con las medidas del formulario", async () => {
    vi.mocked(inventoryService.labelFormats.create).mockResolvedValue({ ...own, id: 8 });
    renderWithProviders(<FormatManager open onOpenChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nuevo formato" }));
    await user.type(screen.getByLabelText("Nombre"), "Mi hoja");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(inventoryService.labelFormats.create).toHaveBeenCalled());
    expect(vi.mocked(inventoryService.labelFormats.create).mock.calls[0][0]).toMatchObject({
      name: "Mi hoja", kind: "sheet", columns: 3, rows: 8, label_width_mm: 63.5,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Formato guardado"));
  });

  it("en un rollo la página es la etiqueta", async () => {
    vi.mocked(inventoryService.labelFormats.create).mockResolvedValue({ ...own, id: 9 });
    renderWithProviders(<FormatManager open onOpenChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nuevo formato" }));
    await user.type(screen.getByLabelText("Nombre"), "Rollo");
    await user.click(screen.getByRole("radio", { name: "Rollo" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(inventoryService.labelFormats.create).toHaveBeenCalled());
    expect(vi.mocked(inventoryService.labelFormats.create).mock.calls[0][0]).toMatchObject({
      kind: "roll", columns: 1, rows: 1, page_width_mm: 63.5, label_width_mm: 63.5, margin_top_mm: 0,
    });
  });

  it("muestra el motivo cuando la API rechaza las medidas", async () => {
    vi.mocked(inventoryService.labelFormats.create).mockRejectedValue(
      Object.assign(new Error("422"), { isAxiosError: true, response: { data: { error: { message: "Las columnas no caben en el ancho de la hoja" } } } }),
    );
    renderWithProviders(<FormatManager open onOpenChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nuevo formato" }));
    await user.type(screen.getByLabelText("Nombre"), "Imposible");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Las columnas no caben en el ancho de la hoja");
  });

  it("pide el nombre antes de guardar", async () => {
    renderWithProviders(<FormatManager open onOpenChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nuevo formato" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(within(screen.getByRole("form", { name: "Nuevo formato" })).getByRole("alert")).toHaveTextContent("Escribe un nombre");
    expect(inventoryService.labelFormats.create).not.toHaveBeenCalled();
  });

  it("edita y borra con confirmación", async () => {
    vi.mocked(inventoryService.labelFormats.update).mockResolvedValue(own);
    vi.mocked(inventoryService.labelFormats.remove).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithProviders(<FormatManager open onOpenChange={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Editar Estante" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(inventoryService.labelFormats.update).toHaveBeenCalledWith(7, expect.objectContaining({ name: "Estante" })));

    await user.click(await screen.findByRole("button", { name: "Borrar Estante" }));
    await waitFor(() => expect(inventoryService.labelFormats.remove).toHaveBeenCalledWith(7));
  });
});
