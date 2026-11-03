import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Company, Subscription } from "@/types";

const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock("@/services/subscription", () => ({ updateModules: vi.fn(), getCompanyModules: vi.fn(), addAddon: vi.fn(), removeAddon: vi.fn(), reactivateAddon: vi.fn() }));

import { addAddon, getCompanyModules, reactivateAddon, removeAddon, updateModules } from "@/services/subscription";
import { CompanyModulesSheet } from "./company-modules-sheet";

const company = { id: 12, name: "Taller Uno" } as Company;
const subscription = {
  plan: "basic", status: "active", available_modules: ["employees", "attendance", "inventory"],
  active_modules: ["employees", "attendance", "inventory"],
} as unknown as Subscription;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateModules).mockResolvedValue({} as never);
  vi.mocked(getCompanyModules).mockResolvedValue({ addons: [], changes: [] } as never);
});

const addon = (over = {}) => ({ key: "pos", requires: ["inventory"], available: true, price: { monthly: 19_900, annual: 199_000 }, cycle: "monthly", state: "off", ends_at: null, ...over });
const withAddon = (over = {}, changes: unknown[] = []) => vi.mocked(getCompanyModules).mockResolvedValue({ addons: [addon(over)], changes } as never);

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

  it("el extra no sale en la lista genérica aunque la empresa ya lo tenga disponible", () => {
    const withPos = { ...subscription, available_modules: [...subscription.available_modules, "pos"], active_modules: [...subscription.active_modules, "pos"] } as unknown as Subscription;
    renderWithProviders(<CompanyModulesSheet company={company} subscription={withPos} onOpenChange={() => {}} />);
    expect(screen.getAllByRole("switch")).toHaveLength(3);
  });
});

describe("módulo extra para el super admin (spec 053)", () => {
  it("lo muestra apagado con su precio y, al encenderlo, pide confirmar el cambio de precio", async () => {
    withAddon();
    vi.mocked(addAddon).mockResolvedValue({} as never);
    renderWithProviders(<CompanyModulesSheet company={company} subscription={subscription} onOpenChange={() => {}} />);

    expect(await screen.findByText(/\$199\.00 al mes · sin IVA/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Punto de venta" }));
    expect(screen.getByText("¿Encender Punto de venta?")).toBeInTheDocument();
    expect(screen.getByText(/sube \$199\.00 al mes más IVA/)).toBeInTheDocument();
    expect(addAddon).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(addAddon).toHaveBeenCalledWith("pos", 12));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Cambio aplicado"));
  });

  it("encendido, apagarlo avisa hasta cuándo lo conserva la empresa", async () => {
    withAddon({ state: "active" });
    vi.mocked(removeAddon).mockResolvedValue({} as never);
    const sub = { ...subscription, current_period_end: "2026-12-01T12:00:00Z" } as unknown as Subscription;
    renderWithProviders(<CompanyModulesSheet company={company} subscription={sub} onOpenChange={() => {}} />);

    await userEvent.click(await screen.findByRole("switch", { name: "Punto de venta" }));
    expect(screen.getByText(/lo conserva hasta el 1 dic 2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(removeAddon).toHaveBeenCalledWith("pos", 12));
  });

  it("con la baja programada ofrece reactivar", async () => {
    withAddon({ state: "ending", ends_at: "2026-12-15T12:00:00Z" });
    vi.mocked(reactivateAddon).mockResolvedValue({} as never);
    renderWithProviders(<CompanyModulesSheet company={company} subscription={subscription} onOpenChange={() => {}} />);

    expect(await screen.findByText("Activo hasta el 15 dic 2026")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(reactivateAddon).toHaveBeenCalledWith("pos", 12));
  });

  it("sin precios en la cuenta de cobro lo explica y no deja encenderlo", async () => {
    withAddon({ available: false });
    renderWithProviders(<CompanyModulesSheet company={company} subscription={subscription} onOpenChange={() => {}} />);

    expect(await screen.findByText(/Faltan sus precios/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Punto de venta" })).toBeDisabled();
  });

  it("en la prueba lo marca sin cobro y muestra los últimos cambios con su precio", async () => {
    withAddon({ state: "trial" }, [{ module: "pos", enabled: true, actor: "Super Admin", amount_before_cents: 0, amount_after_cents: 19_900, created_at: "2026-11-03T12:00:00Z" }]);
    renderWithProviders(<CompanyModulesSheet company={company} subscription={subscription} onOpenChange={() => {}} />);

    expect(await screen.findByText("Activo en la prueba, sin cobro")).toBeInTheDocument();
    expect(screen.getByText(/Punto de venta encendido por Super Admin el 3 nov 2026 · \$0\.00 → \$199\.00/)).toBeInTheDocument();
  });

  it("si el cobro falla lo dice y no confirma el cambio", async () => {
    withAddon();
    vi.mocked(addAddon).mockRejectedValue({ response: { data: { error: { details: { code: "addon_payment_failed" } } } } });
    renderWithProviders(<CompanyModulesSheet company={company} subscription={subscription} onOpenChange={() => {}} />);

    await userEvent.click(await screen.findByRole("switch", { name: "Punto de venta" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("No se pudo cobrar. Revisa el método de pago de la empresa."));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
