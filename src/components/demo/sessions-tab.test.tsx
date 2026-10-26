import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { DemoSession } from "@/types";

vi.mock("@/services/demo", () => ({
  demoService: { listSessions: vi.fn(), listInvites: vi.fn(), createInvite: vi.fn(), revokeInvite: vi.fn(), open: vi.fn(), resolveInvite: vi.fn(), finish: vi.fn() },
}));
const downloadCsv = vi.hoisted(() => vi.fn());
vi.mock("@/lib/reports/csv", async (importActual) => ({ ...(await importActual<typeof import("@/lib/reports/csv")>()), downloadCsv }));

import { demoService } from "@/services/demo";
import { SessionsTab } from "./sessions-tab";

const session = (over: Partial<DemoSession> = {}): DemoSession => ({
  id: 1, plan: "pro", scenario: "pro_restaurant", locale: "es", created_at: "2030-01-02T10:00:00Z", expires_at: "2030-01-02T12:00:00Z",
  ended_at: null, ended_reason: null, purged_at: null, invite: null, contact: null, ...over,
});
const page = (results: DemoSession[]) => ({ info: { page_size: 20, page_index: 1, total: results.length, page_start: 1, page_end: results.length, pages_total: 1 }, results });

const rows = [
  session({ id: 1, ended_reason: "signup", ended_at: "2030-01-02T10:30:00Z", contact: { name: "Ana Pérez", email: "ana@ejemplo.mx", phone: null } }),
  session({ id: 2, plan: "basic", scenario: "basic_retail", invite: { id: 5, label: "Abarrotes Lupita" }, ended_reason: "left", ended_at: "2030-01-02T10:10:00Z" }),
  session({ id: 3, ended_reason: "expired", purged_at: "2030-01-02T13:00:00Z" }),
  session({ id: 4 }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(demoService.listSessions).mockResolvedValue(page(rows));
});

describe("SessionsTab", () => {
  it("lista quién abrió cada demo, con origen, contacto y resultado", async () => {
    renderWithProviders(<SessionsTab />);

    const first = (await screen.findByText("Ana Pérez")).closest("tr") as HTMLElement;
    expect(within(first).getByText("ana@ejemplo.mx")).toBeInTheDocument();
    expect(within(first).getByText("Por su cuenta")).toBeInTheDocument();
    expect(within(first).getByText("Pasó al registro")).toBeInTheDocument();
    const second = screen.getByText("Abarrotes Lupita").closest("tr") as HTMLElement;
    expect(within(second).getByText("Salió")).toBeInTheDocument();
    expect(screen.getByText("Venció")).toBeInTheDocument();
    expect(screen.getByText("En curso")).toBeInTheDocument();
  });

  it("muestra qué porcentaje de las aperturas recientes pasó al registro", async () => {
    renderWithProviders(<SessionsTab />);

    expect(await screen.findByTestId("conversion")).toHaveTextContent("En las últimas 4 aperturas, 25 % pasó al registro.");
  });

  it("los filtros viajan a la API", async () => {
    renderWithProviders(<SessionsTab />);
    await screen.findByText("Ana Pérez");

    fireEvent.click(screen.getByLabelText("Solo con contacto"));
    await waitFor(() => expect(demoService.listSessions).toHaveBeenLastCalledWith(expect.objectContaining({ with_contact: true })));
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "pro" } });
    await waitFor(() => expect(demoService.listSessions).toHaveBeenLastCalledWith(expect.objectContaining({ with_contact: true, plan: "pro" })));
  });

  it("exporta a CSV lo que se ve, con el contacto", async () => {
    renderWithProviders(<SessionsTab />);
    await screen.findByText("Ana Pérez");

    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const csv = downloadCsv.mock.calls[0][1] as string;
    expect(csv).toContain("Ana Pérez");
    expect(csv).toContain("ana@ejemplo.mx");
    expect(csv).toContain("Abarrotes Lupita");
  });

  it("sin aperturas lo dice", async () => {
    vi.mocked(demoService.listSessions).mockResolvedValue(page([]));
    renderWithProviders(<SessionsTab />);

    expect(await screen.findByText("Aún no hay aperturas")).toBeInTheDocument();
    expect(screen.queryByTestId("conversion")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
  });
});
