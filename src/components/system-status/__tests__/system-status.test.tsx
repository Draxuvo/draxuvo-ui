import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

vi.mock("@/services/system-status", () => ({ systemStatusService: { get: vi.fn() } }));

import { systemStatusService } from "@/services/system-status";
import type { SystemStatus as Status } from "@/types";
import { SystemStatus } from "../system-status";

const now = "2026-11-24T19:00:00Z";
const healthy: Status = {
  checked_at: now,
  api: { state: "ok", version: "cfe29d16fbac", booted_at: now, environment: "production" },
  database: { state: "ok", latency_ms: 3 },
  jobs: { state: "ok", last_heartbeat_at: now, pending: 0, running: 1, failed_24h: 0, failures: [], late: [] },
  uptime: {
    state: "ok", reason: null, checked_at: now, stale: false, last_good_at: null,
    monitors: [{ name: "Draxuvo API", url: "https://api.draxuvo.com/up", status: "up", last_checked_at: now, link: "https://bs/monitors/1" }],
    heartbeats: [{ name: "Trabajos", status: "down", link: "https://bs/heartbeats/2" }],
  },
  errors: {
    state: "warn", reason: null, checked_at: now, stale: false, last_good_at: null,
    projects: [
      { slug: "draxuvo-api", unresolved: 1, capped: false, issues: [{ title: "prueba api", count: 3, last_seen: now, link: "https://sentry/1" }] },
      { slug: "draxuvo-ui", unresolved: 0, capped: false, issues: [] },
    ],
  },
  links: { render: "https://dashboard.render.com", sentry: "https://draxuvo.sentry.io/issues/", betterstack: "https://bs" },
};

const card = (name: string) => screen.getByRole("region", { name });

beforeEach(() => vi.mocked(systemStatusService.get).mockReset().mockResolvedValue(healthy));

describe("Estado del sistema (spec 073)", () => {
  it("pinta cada tarjeta con su estado", async () => {
    renderWithProviders(<SystemStatus />);
    await screen.findByRole("region", { name: "API" });

    expect(within(card("API")).getByText("cfe29d1")).toBeInTheDocument();
    expect(within(card("API")).getByText("Bien")).toBeInTheDocument();
    expect(within(card("Base de datos")).getByText("3 ms")).toBeInTheDocument();
    expect(within(card("Disponibilidad")).getByText("Draxuvo API")).toBeInTheDocument();
    expect(within(card("Disponibilidad")).getByText("Caído")).toBeInTheDocument();
    expect(within(card("Errores")).getByText("Atención")).toBeInTheDocument();
    expect(within(card("Errores")).getByRole("link", { name: "prueba api" })).toHaveAttribute("href", "https://sentry/1");
    expect(within(card("Errores")).getByText("3 eventos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Render/ })).toHaveAttribute("href", "https://dashboard.render.com");
  });

  it("muestra trabajos fallidos y atrasados", async () => {
    vi.mocked(systemStatusService.get).mockResolvedValue({
      ...healthy,
      jobs: {
        ...healthy.jobs, state: "down", failed_24h: 1,
        failures: [{ job_class: "Push::ReceiptsJob", error_class: "Net::ReadTimeout", message: "tardó demasiado", at: now }],
        late: [{ key: "monitoring_heartbeat", last_run_at: now, expected_every_seconds: 300 }],
      },
    });
    renderWithProviders(<SystemStatus />);

    expect(await screen.findByText("Push::ReceiptsJob")).toBeInTheDocument();
    expect(screen.getByText("tardó demasiado")).toBeInTheDocument();
    expect(screen.getByText("monitoring_heartbeat")).toBeInTheDocument();
    expect(within(card("Trabajos en segundo plano")).getByText("Mal")).toBeInTheDocument();
  });

  it("explica la tarjeta de un tercero sin token, con token inválido o sin conexión, y el dato viejo", async () => {
    vi.mocked(systemStatusService.get).mockResolvedValue({
      ...healthy,
      uptime: { state: "unconfigured", reason: "missing_token", checked_at: now, stale: false, last_good_at: null },
      errors: { ...healthy.errors, stale: true, last_good_at: now, failure_state: "unreachable" },
    });
    renderWithProviders(<SystemStatus />);

    await screen.findByRole("region", { name: "Disponibilidad" });
    expect(within(card("Disponibilidad")).getByText("Sin configurar")).toBeInTheDocument();
    expect(within(card("Disponibilidad")).getByText("Falta el token de Better Stack en el servidor.")).toBeInTheDocument();
    expect(within(card("Errores")).getByRole("status")).toHaveTextContent("la última lectura falló (Sin conexión)");
  });

  it("Actualizar pide la lectura con refresh", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemStatus />);
    await screen.findByRole("region", { name: "API" });

    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(systemStatusService.get).toHaveBeenLastCalledWith(true);
  });

  it("error con reintentar", async () => {
    vi.mocked(systemStatusService.get).mockRejectedValueOnce(new Error("boom"));
    renderWithProviders(<SystemStatus />);
    expect(await screen.findByText("No se pudo leer el estado del sistema.")).toBeInTheDocument();
  });
});
