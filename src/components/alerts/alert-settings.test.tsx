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
  service.getPreference.mockReset().mockResolvedValue({ stock_email: true } satisfies NotificationPreference);
  service.updatePreference.mockReset().mockImplementation(async (patch) => ({ stock_email: true, ...patch }));
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

  it("no repite el título en las secciones de un solo campo y los campos miden como las listas", async () => {
    renderWithProviders(<AlertSettingsForm />);

    const field = await screen.findByLabelText("Mesa abierta");
    // El título de la sección va a la vista; la etiqueta del campo queda solo para lectores de pantalla.
    expect(screen.getAllByText("Mesa abierta")).toHaveLength(2);
    expect(document.querySelector("label[for='table_open']")).toHaveClass("sr-only");
    // Misma altura que Select y Button (spec 049): sin alturas propias.
    expect(field.className).not.toMatch(/min-h-/);
    expect(screen.getByRole("button", { name: "Guardar cambios" }).className).not.toMatch(/min-h-/);
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

  it("solo ofrece el correo: no hay WhatsApp, ni aviso de teléfono, ni enlace a «Mi perfil» (spec 048)", async () => {
    renderWithProviders(<MyNotifications />);

    expect(await screen.findByRole("switch", { name: "Correo" })).toBeChecked();
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
    expect(screen.queryByText(/teléfono/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ir a mi perfil" })).not.toBeInTheDocument();
  });

  it("explica que, aun sin correo, el stock bajo se ve en el panel y en la app", async () => {
    renderWithProviders(<MyNotifications />);

    expect(await screen.findByText(/se sigue viendo en el panel y en la app/)).toBeInTheDocument();
  });

  it("solo manda stock_email al cambiar el canal", async () => {
    const user = userEvent.setup();
    service.getPreference.mockResolvedValue({ stock_email: false } satisfies NotificationPreference);
    renderWithProviders(<MyNotifications />);

    await user.click(await screen.findByRole("switch", { name: "Correo" }));
    await waitFor(() => expect(service.updatePreference).toHaveBeenCalledWith({ stock_email: true }));
  });
});
