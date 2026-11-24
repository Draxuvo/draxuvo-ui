import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const nav = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => "/es/accesos",
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock("@/services/login-attempts", () => ({ loginAttemptsService: { list: vi.fn(), summary: vi.fn() } }));
vi.mock("@/services/companies", () => ({
  companiesService: { list: vi.fn(async () => ({ info: {}, results: [{ id: 7, name: "Electricidad Volta" }] })) },
}));

import { loginAttemptsService } from "@/services/login-attempts";
import type { LoginAttempt } from "@/types";
import { AccessLog } from "../access-log";

const info = { page_size: 50, page_index: 1, total: 3, pages_total: 1, page_start: 1, page_end: 3 };
const base = { companies: [], ip: "189.203.10.4", user_agent: null, client_version: null, demo: false };
const rows: LoginAttempt[] = [
  { ...base, id: 3, created_at: "2026-11-24T19:05:00Z", result: "wrong_password", email: "dueno@volta.demo",
    user: { id: 1, name: "Jesús Pérez", deleted: false }, companies: [{ id: 7, name: "Electricidad Volta" }], channel: "app", device: "App · Android" },
  { ...base, id: 2, created_at: "2026-11-24T19:00:00Z", result: "unknown_email", email: "nadie@x.test", user: null, channel: "panel", device: "Chrome · macOS" },
  { ...base, id: 1, created_at: "2026-11-24T18:00:00Z", result: "rate_limited", email: "borrada@x.test",
    user: { id: null, name: null, deleted: true }, channel: "unknown", device: null },
];

const summary = {
  today: { success: 4, failures: 2 },
  window_minutes: 60,
  top_ips: [{ ip: "189.203.10.4", failures: 6 }],
  top_emails: [{ email: "dueno@volta.demo", failures: 4 }],
};

beforeEach(() => {
  nav.query = "";
  nav.replace.mockReset();
  vi.mocked(loginAttemptsService.list).mockResolvedValue({ info, results: rows });
  vi.mocked(loginAttemptsService.summary).mockResolvedValue(summary);
});

describe("Accesos (spec 073)", () => {
  it("pinta cada intento con su resultado, persona, empresas, IP, dispositivo y canal", async () => {
    renderWithProviders(<AccessLog />);
    const table = await screen.findByRole("table");

    expect(within(table).getByText("Contraseña incorrecta")).toHaveAttribute("data-tone", "warn");
    expect(within(table).getByText("Bloqueado por intentos")).toHaveAttribute("data-tone", "bad");
    expect(within(table).getByText("Jesús Pérez")).toBeInTheDocument();
    expect(within(table).getAllByText("Correo sin cuenta").length).toBeGreaterThan(0);
    expect(within(table).getByText("Cuenta eliminada")).toBeInTheDocument();
    expect(within(table).getByText("App · Android")).toBeInTheDocument();
    expect(within(table).getByText("Electricidad Volta")).toBeInTheDocument();
    expect(within(table).getByText("App")).toBeInTheDocument();
    expect(within(table).getAllByText("Desconocido").length).toBe(2);
    // 19:05 UTC son las 13:05 en la Ciudad de México.
    expect(within(table).getByText(/13:05/)).toBeInTheDocument();
  });

  it("lee los filtros de la URL y los manda a la API", async () => {
    nav.query = "result=failures&q=volta&company=7&channel=app&page=2";
    renderWithProviders(<AccessLog />);

    await waitFor(() =>
      expect(loginAttemptsService.list).toHaveBeenCalledWith({
        result: ["failures"], q: "volta", company_id: 7, channel: "app", page: 2, page_size: 50,
      }),
    );
  });

  it("cambiar un filtro actualiza la URL y vuelve a la página 1", async () => {
    nav.query = "page=3";
    const user = userEvent.setup();
    renderWithProviders(<AccessLog />);
    await screen.findByRole("table");

    await user.selectOptions(screen.getByLabelText("Resultado"), "wrong_password");
    expect(nav.replace).toHaveBeenLastCalledWith("/es/accesos?result=wrong_password", { scroll: false });

    await user.type(screen.getByLabelText("IP"), "10.0.0.1");
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/es/accesos?ip=10.0.0.1", { scroll: false });
  });

  it("el resumen muestra hoy y la última hora, y tocar una IP filtra por ella", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccessLog />);

    expect(await screen.findByText("4 entradas")).toBeInTheDocument();
    expect(screen.getByText("2 fallos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /189\.203\.10\.4/ }));
    expect(nav.replace).toHaveBeenLastCalledWith("/es/accesos?result=failures&since=60&ip=189.203.10.4", { scroll: false });
  });

  it("sin fallos en la última hora lo dice", async () => {
    vi.mocked(loginAttemptsService.summary).mockResolvedValue({ ...summary, top_ips: [], top_emails: [] });
    renderWithProviders(<AccessLog />);
    expect(await screen.findByText("Sin intentos fallidos en la última hora.")).toBeInTheDocument();
  });

  it("vacío con guía y error con reintentar", async () => {
    vi.mocked(loginAttemptsService.list).mockResolvedValueOnce({ info: { ...info, total: 0 }, results: [] });
    const { unmount } = renderWithProviders(<AccessLog />);
    expect(await screen.findByText("Sin intentos")).toBeInTheDocument();
    unmount();

    vi.mocked(loginAttemptsService.list).mockRejectedValueOnce(new Error("boom"));
    renderWithProviders(<AccessLog />);
    expect(await screen.findByText("No se pudieron cargar los accesos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
