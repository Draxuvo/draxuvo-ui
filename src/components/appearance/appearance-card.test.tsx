import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { AppearanceProvider } from "./appearance-provider";
import { AppearanceCard } from "./appearance-card";

const saveAppearance = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/services/profile", () => ({ profileService: { saveAppearance } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

function renderCard() {
  return renderWithProviders(
    <AppearanceProvider>
      <AppearanceCard />
    </AppearanceProvider>,
  );
}

beforeEach(() => {
  saveAppearance.mockReset();
  toastError.mockReset();
  document.documentElement.dataset.theme = "anaquel";
  document.documentElement.dataset.mode = "system";
});

describe("AppearanceCard", () => {
  it("marca el tema y el modo actuales", () => {
    renderCard();
    expect(screen.getByRole("radio", { name: /^Anaquel\./ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Igual que mi dispositivo" })).toBeChecked();
    expect(screen.getByText("En uso")).toBeInTheDocument();
  });

  it("elegir un tema lo aplica al instante y lo guarda en la cuenta", async () => {
    saveAppearance.mockResolvedValue({ id: 1 });
    renderCard();
    await userEvent.click(screen.getByRole("radio", { name: /^Mercado\./ }));
    expect(document.documentElement.dataset.theme).toBe("mercado");
    expect(screen.getByRole("radio", { name: /^Mercado\./ })).toBeChecked();
    await waitFor(() => expect(saveAppearance).toHaveBeenCalledWith({ theme: "mercado", color_mode: "system" }));
  });

  it("elegir un modo lo aplica y lo guarda junto con el tema vigente", async () => {
    saveAppearance.mockResolvedValue({ id: 1 });
    renderCard();
    await userEvent.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(document.documentElement.dataset.mode).toBe("dark");
    await waitFor(() => expect(saveAppearance).toHaveBeenCalledWith({ theme: "anaquel", color_mode: "dark" }));
  });

  it("si el guardado falla avisa y conserva la elección", async () => {
    saveAppearance.mockRejectedValue(new Error("red"));
    renderCard();
    await userEvent.click(screen.getByRole("radio", { name: /^Talavera\./ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Se aplicó en este dispositivo, pero no se guardó en tu cuenta."),
    );
    expect(document.documentElement.dataset.theme).toBe("talavera");
    expect(screen.getByRole("radio", { name: /^Talavera\./ })).toBeChecked();
  });

  it("elegir la selección actual no hace nada", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("radio", { name: /^Anaquel\./ }));
    await userEvent.click(screen.getByRole("radio", { name: "Igual que mi dispositivo" }));
    expect(saveAppearance).not.toHaveBeenCalled();
  });
});
