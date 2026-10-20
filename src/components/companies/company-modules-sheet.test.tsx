import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Company, Subscription } from "@/types";

const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock("@/services/subscription", () => ({ updateModules: vi.fn() }));

import { updateModules } from "@/services/subscription";
import { CompanyModulesSheet } from "./company-modules-sheet";

const company = { id: 12, name: "Taller Uno" } as Company;
const subscription = {
  plan: "basic", status: "active", available_modules: ["employees", "attendance", "inventory"],
  active_modules: ["employees", "attendance", "inventory"],
} as unknown as Subscription;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateModules).mockResolvedValue({} as never);
});

describe("módulos de una empresa para el super admin (spec 017)", () => {
  it("lista solo los módulos del plan, con el plan y el estado de la suscripción", () => {
    renderWithProviders(<CompanyModulesSheet company={company} subscription={subscription} onOpenChange={() => {}} />);

    expect(screen.getByText("Módulos de Taller Uno")).toBeInTheDocument();
    expect(screen.getByText("Plan Básico · suscripción: active")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(3);
    expect(screen.queryByText("Restaurante")).not.toBeInTheDocument();
  });

  it("desactivar un módulo manda la lista con ese módulo y el id de la empresa, y avisa", async () => {
    renderWithProviders(<CompanyModulesSheet company={company} subscription={subscription} onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("switch", { name: "Inventario" }));

    await waitFor(() => expect(updateModules).toHaveBeenCalledWith(["inventory"], 12));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Módulos actualizados"));
  });

  it("activar un módulo desactivado lo quita de la lista", async () => {
    const off = { ...subscription, active_modules: ["employees", "attendance"] } as unknown as Subscription;
    renderWithProviders(<CompanyModulesSheet company={company} subscription={off} onOpenChange={() => {}} />);
    expect(screen.getByRole("switch", { name: "Inventario" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("switch", { name: "Inventario" }));
    await waitFor(() => expect(updateModules).toHaveBeenCalledWith([], 12));
  });

  it("si guardar falla avisa y el interruptor vuelve a su estado", async () => {
    vi.mocked(updateModules).mockRejectedValue(new Error("boom"));
    renderWithProviders(<CompanyModulesSheet company={company} subscription={subscription} onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("switch", { name: "Inventario" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudieron actualizar los módulos"));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Inventario" })).toBeChecked());
  });

  it("sin suscripción no hay módulos que administrar", () => {
    renderWithProviders(<CompanyModulesSheet company={company} subscription={null} onOpenChange={() => {}} />);
    expect(screen.getByText("Sin suscripción: no hay módulos que administrar.")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
