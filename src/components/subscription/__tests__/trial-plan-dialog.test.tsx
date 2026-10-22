import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Company } from "@/types";

vi.mock("@/services/subscription", () => ({ updateCompanyTrialPlan: vi.fn().mockResolvedValue({}) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { updateCompanyTrialPlan } from "@/services/subscription";
import { TrialPlanDialog } from "../trial-plan-dialog";

const company = { id: 9, name: "Volta" } as Company;

beforeEach(() => vi.clearAllMocks());

describe("TrialPlanDialog (spec 031)", () => {
  it("el super admin elige otro plan y se manda para esa empresa", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<TrialPlanDialog company={company} currentPlan="pro" onOpenChange={onOpenChange} />);

    expect(screen.getByText("Cambiar plan de prueba de Volta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar plan" })).toBeDisabled(); // mismo plan: nada que guardar
    await userEvent.click(screen.getByRole("button", { name: "Empresa" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar plan" }));

    await waitFor(() => expect(updateCompanyTrialPlan).toHaveBeenCalledWith(9, "enterprise"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("sin empresa no se muestra", () => {
    renderWithProviders(<TrialPlanDialog company={null} onOpenChange={() => {}} />);
    expect(screen.queryByText(/Cambiar plan de prueba de/)).not.toBeInTheDocument();
  });
});
