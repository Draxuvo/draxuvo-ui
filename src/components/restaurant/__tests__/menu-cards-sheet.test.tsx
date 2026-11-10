import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { MenuLink } from "@/types";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() } }));
vi.mock("@/services/restaurant", () => ({
  restaurantService: {
    menuLinks: vi.fn(),
    regenerateMenuLink: vi.fn(),
    menuCardsPdf: vi.fn(),
  },
}));

import { restaurantService } from "@/services/restaurant";
import { MenuCardsSheet } from "../menu-qr/menu-cards-sheet";

const link = (id: number, name: string): MenuLink => ({
  table_id: id,
  name,
  url: `https://draxuvo.com/m/token-${id}`,
  generated_at: "2026-11-09T12:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(restaurantService.menuLinks).mockResolvedValue([link(1, "1"), link(2, "2"), link(3, "Terraza")]);
  vi.mocked(restaurantService.menuCardsPdf).mockResolvedValue(new Blob(["%PDF"]));
  vi.mocked(restaurantService.regenerateMenuLink).mockResolvedValue({ ...link(2, "2"), url: "https://draxuvo.com/m/nuevo" });
  URL.createObjectURL = vi.fn(() => "blob:tarjetas");
  URL.revokeObjectURL = vi.fn();
});

function renderSheet() {
  return renderWithProviders(<MenuCardsSheet open onOpenChange={vi.fn()} />);
}

describe("MenuCardsSheet", () => {
  it("lists the active tables with their links, all selected", async () => {
    renderSheet();

    expect(await screen.findByText("https://draxuvo.com/m/token-1")).toBeInTheDocument();
    expect(screen.getByText("Terraza")).toBeInTheDocument();
    expect(screen.getByText("3 mesas seleccionadas")).toBeInTheDocument();
    for (const name of ["1", "2", "Terraza"]) {
      expect(screen.getByRole("checkbox", { name: `Imprimir la tarjeta de ${name}` })).toBeChecked();
    }
    expect(screen.getByRole("link", { name: "Abrir menú: Terraza" })).toHaveAttribute("href", "https://draxuvo.com/m/token-3");
  });

  it("downloads every table without ids when all are selected", async () => {
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("Terraza");

    await user.click(screen.getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(restaurantService.menuCardsPdf).toHaveBeenCalledWith(undefined));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("downloads only the selected tables", async () => {
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("Terraza");

    await user.click(screen.getByRole("checkbox", { name: "Imprimir la tarjeta de 2" }));
    expect(screen.getByText("2 mesas seleccionadas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(restaurantService.menuCardsPdf).toHaveBeenCalledWith([1, 3]));
  });

  it("cannot download with nothing selected", async () => {
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("Terraza");

    await user.click(screen.getByRole("button", { name: "Ninguna" }));
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Marcar todas" }));
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeEnabled();
  });

  it("copies a link", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderSheet();
    await screen.findByText("Terraza");

    await user.click(screen.getByRole("button", { name: "Copiar enlace: Terraza" }));
    expect(writeText).toHaveBeenCalledWith("https://draxuvo.com/m/token-3");
    expect(toastSuccess).toHaveBeenCalledWith("Enlace copiado");
  });

  it("explains how to start when there are no tables", async () => {
    vi.mocked(restaurantService.menuLinks).mockResolvedValue([]);
    renderSheet();

    expect(await screen.findByText(/Primero da de alta mesas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeDisabled();
  });

  it("offers to retry when the links fail to load", async () => {
    const user = userEvent.setup();
    vi.mocked(restaurantService.menuLinks).mockRejectedValueOnce(new Error("boom"));
    renderSheet();

    await user.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Terraza")).toBeInTheDocument();
  });

  // --- US3: regenerar ---

  it("regenerates a link after confirming and refreshes the list", async () => {
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("Terraza");

    await user.click(screen.getByRole("button", { name: "Regenerar enlace: 2" }));
    expect(screen.getByText("¿Regenerar el enlace de 2?")).toBeInTheDocument();
    expect(screen.getByText(/dejarán de funcionar/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Regenerar" }));
    await waitFor(() => expect(restaurantService.regenerateMenuLink).toHaveBeenCalledWith(2));
    await waitFor(() => expect(restaurantService.menuLinks).toHaveBeenCalledTimes(2));
    expect(toastSuccess).toHaveBeenCalledWith("Enlace nuevo listo; imprime la tarjeta de esta mesa.");
  });

  it("cancelling the confirmation keeps the link", async () => {
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("Terraza");

    await user.click(screen.getByRole("button", { name: "Regenerar enlace: 2" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(restaurantService.regenerateMenuLink).not.toHaveBeenCalled();
  });
});
