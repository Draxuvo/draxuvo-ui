import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/company-logo", () => ({ companyLogoService: { upload: vi.fn(), remove: vi.fn() } }));

import { toast } from "sonner";
import { companyLogoService } from "@/services/company-logo";
import { LogoCard, logoProblem } from "../logo-card";

const png = (bytes = 10) => new File(["x".repeat(bytes)], "logo.png", { type: "image/png" });
const fetchMe = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:local");
  URL.revokeObjectURL = vi.fn();
  useAuthStore.setState({ fetchMe } as never);
});

describe("logoProblem", () => {
  it("acepta JPG, PNG y WebP de hasta 5 MB", () => {
    expect(logoProblem(png())).toBeNull();
    expect(logoProblem(new File(["x"], "a.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(logoProblem(new File(["x"], "a.webp", { type: "image/webp" }))).toBeNull();
    expect(logoProblem(new File(["x"], "a.svg", { type: "image/svg+xml" }))).toBe("invalidType");
    const big = png();
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
    expect(logoProblem(big)).toBe("tooLarge");
  });
});

describe("LogoCard (spec 063, US1)", () => {
  it("sin logo ofrece subirlo; al elegirlo lo sube con avance y refresca la sesión", async () => {
    const user = userEvent.setup();
    vi.mocked(companyLogoService.upload).mockResolvedValue({ logo: { url: "https://api.test/logo.webp", updated_at: null, updated_by: null } });
    renderWithProviders(<LogoCard companyName="Aquí me quedo" logoUrl={null} />);

    expect(screen.getByRole("button", { name: "Subir logo" })).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Elegir imagen del logo"), png());

    await waitFor(() => expect(companyLogoService.upload).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ signal: expect.any(AbortSignal) })));
    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Logo guardado");
  });

  it("rechaza en el navegador un formato no admitido sin subir nada", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<LogoCard companyName="Aquí me quedo" logoUrl={null} />);
    await user.upload(screen.getByLabelText("Elegir imagen del logo"), new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El archivo debe ser JPG, PNG o WebP");
    expect(companyLogoService.upload).not.toHaveBeenCalled();
  });

  it("explica el error 422 de la API", async () => {
    const user = userEvent.setup();
    vi.mocked(companyLogoService.upload).mockRejectedValue({ isAxiosError: true, response: { data: { error: { details: { code: "logo_too_large" } } } } });
    renderWithProviders(<LogoCard companyName="Aquí me quedo" logoUrl={null} />);
    await user.upload(screen.getByLabelText("Elegir imagen del logo"), png());
    expect(await screen.findByRole("alert")).toHaveTextContent("El logo no puede pasar de 5 MB");
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it("con logo lo muestra en claro y oscuro, y lo quita tras confirmar", async () => {
    const user = userEvent.setup();
    vi.mocked(companyLogoService.remove).mockResolvedValue({ logo: null });
    renderWithProviders(<LogoCard companyName="Aquí me quedo" logoUrl="https://api.test/logo.webp" />);

    expect(screen.getAllByRole("img", { name: "Logo de Aquí me quedo" })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Quitar logo" }));
    expect(companyLogoService.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));

    await waitFor(() => expect(companyLogoService.remove).toHaveBeenCalled());
    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Logo quitado");
  });
});
