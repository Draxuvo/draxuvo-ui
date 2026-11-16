import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Company } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/company-logo", () => ({ companyLogoService: { upload: vi.fn(), remove: vi.fn() } }));

import { companyLogoService } from "@/services/company-logo";
import { CompanyLogoSection } from "./company-logo-section";

const base = { id: 23, name: "Aquí me quedo", slug: "aqu-me-quedo", active: true, created_at: "2026-11-04T00:00:00Z" };

beforeEach(() => vi.clearAllMocks());

describe("logo en la hoja del super admin (spec 063, US3)", () => {
  it("sin logo lo dice", () => {
    renderWithProviders(<CompanyLogoSection company={{ ...base, logo: null } as Company} />);
    expect(screen.getByText(/Sin logo/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar logo" })).not.toBeInTheDocument();
  });

  it("muestra el logo con quién lo cambió y lo quita en esa empresa tras confirmar", async () => {
    const user = userEvent.setup();
    vi.mocked(companyLogoService.remove).mockResolvedValue({ logo: null });
    const company = {
      ...base,
      logo: { url: "https://api.test/logo.webp", updated_at: "2026-11-15T20:00:00Z", updated_by: { id: 47, name: "Perfecta Mendoza" } },
    } as Company;
    renderWithProviders(<CompanyLogoSection company={company} />);

    expect(screen.getByRole("img", { name: "Logo de Aquí me quedo" })).toHaveAttribute("src", "https://api.test/logo.webp");
    expect(screen.getByText(/Perfecta Mendoza/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar logo" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));
    await waitFor(() => expect(companyLogoService.remove).toHaveBeenCalledWith(23));
    expect(await screen.findByText(/Sin logo/)).toBeInTheDocument();
  });
});
