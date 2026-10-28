import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { AlertsResponse, OperationalAlert, SnoozedAlert } from "@/types";
import { AlertBell } from "./alert-bell";
import { AlertList } from "./alert-list";

const service = vi.hoisted(() => ({
  list: vi.fn(),
  snooze: vi.fn(),
  unsnooze: vi.fn(),
}));

vi.mock("@/services/alerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/alerts")>()),
  alertsService: service,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const table: OperationalAlert = {
  id: "table_open:check:45:t:1730000000",
  kind: "table_open",
  severity: "critical",
  minutes: 190,
  threshold_minutes: 90,
  subject: { type: "check", id: 45, label: "Mesa 4", check_id: 45 },
  owner: { type: "waiter", name: "Ana López" },
  total: "845.00",
  stock: null,
  min_stock: null,
};
const round: OperationalAlert = {
  id: "kitchen_wait:ko:12:st:3",
  kind: "kitchen_wait",
  severity: "warning",
  minutes: 14,
  threshold_minutes: 10,
  subject: { type: "kitchen_order", id: 12, label: "Mesa 4 · Comanda #1 · Cocina", check_id: 45 },
  owner: { type: "station", name: "Cocina" },
  total: null,
  stock: null,
  min_stock: null,
};
const stock: OperationalAlert = {
  id: "low_stock:product:9",
  kind: "low_stock",
  severity: "warning",
  minutes: null,
  threshold_minutes: null,
  subject: { type: "product", id: 9, label: "Café en grano" },
  owner: null,
  total: null,
  stock: 1.5,
  min_stock: 3,
};
const snoozed: SnoozedAlert = {
  ...table,
  id: "table_open:check:50:t:1730001000",
  subject: { type: "check", id: 50, label: "Mesa 7", check_id: 50 },
  snoozed_until: "2026-10-28T02:30:00Z",
  snoozed_by: "Luis Pérez",
};

function response(over: Partial<AlertsResponse> = {}): AlertsResponse {
  const results = over.results ?? [table, round, stock];
  return {
    info: { page_size: 50, page_index: 1, total: results.length, page_start: 1, page_end: results.length, pages_total: 1 },
    count: results.length,
    results,
    snoozed: [],
    ...over,
  };
}

beforeEach(() => {
  service.list.mockReset().mockResolvedValue(response());
  service.snooze.mockReset().mockResolvedValue({});
  service.unsnooze.mockReset().mockResolvedValue({});
  useAuthStore.setState({ role: "owner", selectedCompanyId: 7 });
});

describe("AlertBell (spec 045)", () => {
  it("muestra el conteo de alertas activas y lleva a /alertas", async () => {
    renderWithProviders(<AlertBell />);
    const link = await screen.findByRole("link", { name: "Alertas, 3 activas" });
    expect(link).toHaveAttribute("href", expect.stringMatching(/\/alertas$/));
    expect(screen.getByTestId("alert-count")).toHaveTextContent("3");
  });

  it("sin alertas no pinta el número", async () => {
    service.list.mockResolvedValue(response({ results: [], count: 0 }));
    renderWithProviders(<AlertBell />);
    expect(await screen.findByRole("link", { name: "Alertas" })).toBeInTheDocument();
    expect(screen.queryByTestId("alert-count")).not.toBeInTheDocument();
  });

  it("el personal (staff) no ve la campana ni consulta nada", () => {
    useAuthStore.setState({ role: "staff" });
    renderWithProviders(<AlertBell />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(service.list).not.toHaveBeenCalled();
  });
});

describe("AlertList (spec 045)", () => {
  it("lista cada alerta con su tipo, tiempo, responsable y total", async () => {
    renderWithProviders(<AlertList />);

    expect(await screen.findByText("Mesa 4")).toBeInTheDocument();
    expect(screen.getByText(/Mesa abierta mucho tiempo · Mesero: Ana López/)).toBeInTheDocument();
    expect(screen.getByText(/Lleva 3 h 10 min \(límite 1 h 30 min\)/)).toBeInTheDocument();
    expect(screen.getByText(/Total \$845\.00/)).toBeInTheDocument();
    expect(screen.getByText("Mesa 4 · Comanda #1 · Cocina")).toBeInTheDocument();
    expect(screen.getByText(/Comanda sin atender · Estación: Cocina/)).toBeInTheDocument();
    expect(screen.getByText("3 alertas activas")).toBeInTheDocument();
    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it("cada alerta abre su elemento", async () => {
    renderWithProviders(<AlertList />);
    const links = await screen.findAllByRole("link", { name: "Abrir" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/es/pedido?cuenta=45",
      "/es/pedido?cuenta=45",
      "/es/inventario?search=Caf%C3%A9%20en%20grano",
    ]);
  });

  it("el stock bajo muestra existencia y mínimo y no se puede posponer", async () => {
    renderWithProviders(<AlertList />);
    expect(await screen.findByText("Existencia 1.5 · Mínimo 3")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Posponer" })).toHaveLength(2);
  });

  it("pospone una alerta de tiempo con la clave de su elemento", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AlertList />);

    const buttons = await screen.findAllByRole("button", { name: "Posponer" });
    await user.click(buttons[0]);
    await user.click(await screen.findByRole("menuitem", { name: "1 hora" }));

    await waitFor(() =>
      expect(service.snooze).toHaveBeenCalledWith({ kind: "table_open", subject_key: "check:45:t:1730000000", minutes: 60 }),
    );
  });

  it("las pospuestas van aparte, con su hora y quién las pospuso, y se pueden quitar", async () => {
    const user = userEvent.setup();
    service.list.mockResolvedValue(response({ snoozed: [snoozed] }));
    renderWithProviders(<AlertList />);

    expect(await screen.findByText("Pospuestas (1)")).toBeInTheDocument();
    expect(screen.getByText("Mesa 7")).toBeInTheDocument();
    expect(screen.getByText(/por Luis Pérez/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar posposición" }));
    await waitFor(() => expect(service.unsnooze).toHaveBeenCalledWith("table_open", "check:50:t:1730001000"));
  });

  it("sin nada que atender muestra el estado vacío", async () => {
    service.list.mockResolvedValue(response({ results: [], count: 0 }));
    renderWithProviders(<AlertList />);
    expect(await screen.findByText("Todo en orden")).toBeInTheDocument();
  });

  it("si falla la carga ofrece reintentar", async () => {
    const user = userEvent.setup();
    service.list.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(response());
    renderWithProviders(<AlertList />);

    expect(await screen.findByText("No pudimos cargar las alertas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Mesa 4")).toBeInTheDocument();
  });

  it("con más alertas de las que caben ofrece ver más y pide la página grande", async () => {
    const user = userEvent.setup();
    service.list.mockResolvedValue(response({ count: 120 }));
    renderWithProviders(<AlertList />);

    await user.click(await screen.findByRole("button", { name: "Ver más" }));
    await waitFor(() => expect(service.list).toHaveBeenCalledWith({ pageSize: 100 }));
    expect(await screen.findByText("Mostrando las 3 más urgentes de 120.")).toBeInTheDocument();
  });
});
