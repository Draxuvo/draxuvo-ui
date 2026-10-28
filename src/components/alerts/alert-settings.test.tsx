import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { AlertSettings, NotificationPreference } from "@/types";
import { AlertSettingsForm } from "./alert-settings";
import { MyNotifications } from "./my-notifications";

const service = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getPreference: vi.fn(),
  updatePreference: vi.fn(),
}));

vi.mock("@/services/alerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/alerts")>()),
  alertsService: service,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const defaults = {
  kitchen_wait: { kitchen: 10, bar: 5, other: 10 },
  kitchen_preparing: { kitchen: 25, bar: 10, other: 25 },
  table_open: 90,
  work_order_stalled: 1440,
};

function settings(over: Partial<AlertSettings> = {}): AlertSettings {
  return {
    thresholds: defaults,
    defaults,
    summary_hour: 8,
    time_zone: "America/Mexico_City",
    applicable: ["kitchen_wait", "kitchen_preparing", "table_open", "work_order_stalled", "low_stock"],
    ...over,
  };
}

beforeEach(() => {
  service.getSettings.mockReset().mockResolvedValue(settings());
  service.updateSettings.mockReset().mockImplementation(async (patch) => settings({ thresholds: { ...defaults, ...patch.thresholds }, summary_hour: patch.summary_hour ?? 8 }));
  service.getPreference.mockReset().mockResolvedValue({ stock_email: true, stock_whatsapp: false, phone_present: true, whatsapp_available: true });
  service.updatePreference.mockReset().mockImplementation(async (patch) => ({
    stock_email: true,
    stock_whatsapp: false,
    phone_present: true,
    whatsapp_available: true,
    ...patch,
  }));
  useAuthStore.setState({ role: "owner", selectedCompanyId: 7 });
});

describe("AlertSettingsForm (spec 045, FR-016)", () => {
  it("muestra los límites vigentes de cada tipo de estación y el valor por omisión", async () => {
    renderWithProviders(<AlertSettingsForm />);

    expect(await screen.findByLabelText("Barra", { selector: "#kitchen_wait-bar" })).toHaveValue(5);
    expect(screen.getByLabelText("Cocina", { selector: "#kitchen_preparing-kitchen" })).toHaveValue(25);
    expect(screen.getByLabelText("Mesa abierta")).toHaveValue(90);
    expect(screen.getByLabelText("Hora del resumen")).toHaveValue("8");
    expect(screen.getAllByText("Por omisión: 10 min").length).toBeGreaterThan(0);
  });

  it("guarda solo lo que cambió, con la forma de la API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AlertSettingsForm />);

    const save = await screen.findByRole("button", { name: "Guardar cambios" });
    expect(save).toBeDisabled();

    const field = screen.getByLabelText("Mesa abierta");
    await user.clear(field);
    await user.type(field, "30");
    await user.clear(screen.getByLabelText("Barra", { selector: "#kitchen_wait-bar" }));
    await user.type(screen.getByLabelText("Barra", { selector: "#kitchen_wait-bar" }), "3");
    await user.click(save);

    await waitFor(() =>
      expect(service.updateSettings).toHaveBeenCalledWith({ thresholds: { table_open: 30, kitchen_wait: { bar: 3 } } }),
    );
  });

  it("rechaza valores fuera de rango y no deja guardar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AlertSettingsForm />);

    const field = await screen.findByLabelText("Mesa abierta");
    for (const bad of ["0", "10081"]) {
      await user.clear(field);
      await user.type(field, bad);
      expect(screen.getAllByText("Escribe un número entero entre 1 y 10,080").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    }
    expect(service.updateSettings).not.toHaveBeenCalled();
  });

  it("oculta lo que no aplica según los módulos de la empresa", async () => {
    service.getSettings.mockResolvedValue(settings({ applicable: ["low_stock"] }));
    renderWithProviders(<AlertSettingsForm />);

    expect(await screen.findByText("Resumen diario de stock bajo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Mesa abierta")).not.toBeInTheDocument();
    expect(screen.queryByText("Comanda sin atender")).not.toBeInTheDocument();
  });

  it("cambia la hora del resumen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AlertSettingsForm />);

    await user.selectOptions(await screen.findByLabelText("Hora del resumen"), "9");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(service.updateSettings).toHaveBeenCalledWith({ summary_hour: 9 }));
  });
});

describe("MyNotifications (spec 045, FR-017 y FR-018)", () => {
  it("apaga el correo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyNotifications />);

    await user.click(await screen.findByRole("switch", { name: "Correo" }));
    await waitFor(() => expect(service.updatePreference).toHaveBeenCalledWith({ stock_email: false }));
  });

  it("enciende el WhatsApp cuando hay teléfono", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyNotifications />);

    await user.click(await screen.findByRole("switch", { name: "WhatsApp" }));
    await waitFor(() => expect(service.updatePreference).toHaveBeenCalledWith({ stock_whatsapp: true }));
  });

  it("sin teléfono no deja activar el WhatsApp y manda al perfil", async () => {
    service.getPreference.mockResolvedValue({ stock_email: true, stock_whatsapp: false, phone_present: false, whatsapp_available: true } satisfies NotificationPreference);
    renderWithProviders(<MyNotifications />);

    expect(await screen.findByRole("switch", { name: "WhatsApp" })).toBeDisabled();
    expect(screen.getByText(/Guarda tu teléfono/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a mi perfil" })).toHaveAttribute("href", "/es/perfil");
  });

  it("avisa cuando el servidor aún no manda WhatsApp, sin bloquear el interruptor", async () => {
    service.getPreference.mockResolvedValue({ stock_email: true, stock_whatsapp: false, phone_present: true, whatsapp_available: false });
    renderWithProviders(<MyNotifications />);

    expect(await screen.findByText(/aún no está disponible en el servidor/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "WhatsApp" })).toBeEnabled();
  });
});
