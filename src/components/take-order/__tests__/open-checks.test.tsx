import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { TablesResponse } from "@/types";

vi.mock("@/services/restaurant", () => ({ restaurantService: { overview: vi.fn() } }));

import { restaurantService } from "@/services/restaurant";
import { ClosedChecks, OpenChecks, useClosedChecks, useOpenChecks } from "../open-checks";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const counts = { new: 0, preparing: 0, ready: 0, delivered: 0 };
const overview: TablesResponse = {
  results: [
    { id: 1, name: "4", active: true, position: 1, check: { id: 31, waiter: { id: 1, name: "Sara" }, opened_at: ago(12), total: "155.00", counts, mine: true } },
    { id: 2, name: "5", active: true, position: 2, check: { id: 32, waiter: { id: 2, name: "Luis" }, opened_at: ago(30), total: "80.00", counts, mine: false } },
    { id: 3, name: "6", active: true, position: 3, check: null },
  ],
  takeouts: [{ id: 33, takeout_name: "Mario", waiter: { id: 1, name: "Sara" }, opened_at: ago(3), total: "20.00", counts, mine: true }],
  closed_today: [
    { id: 40, name: "2", takeout_name: null, closed_at: "2026-10-21T18:30:00Z", ticket_id: 7, waiter: { id: 1, name: "Sara" }, total: "380.00", mine: true },
    { id: 41, name: null, takeout_name: "Eva", closed_at: "2026-10-21T17:00:00Z", ticket_id: 8, mine: false },
  ],
  ready_items: [],
};

function Harness({ scope }: { scope: "all" | "mine" }) {
  const checks = useOpenChecks(scope);
  return <OpenChecks checks={checks} from={scope === "all" ? "ordenes" : "mis-ordenes"} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ selectedCompanyId: 1, role: "staff" } as never);
  vi.mocked(restaurantService.overview).mockResolvedValue(overview);
});

describe("OpenChecks", () => {
  it("el operador ve solo las suyas, con mesa, total, mesero y tiempo", async () => {
    renderWithProviders(<Harness scope="mine" />);

    const table = await screen.findByRole("link", { name: "Abrir cuenta de 4" });
    expect(table).toHaveAttribute("href", "/es/pedido?cuenta=31&from=mis-ordenes");
    expect(table).toHaveTextContent("Mesa 4");
    expect(table).toHaveTextContent("$155.00");
    expect(table).toHaveTextContent("Atiende Sara");
    expect(table).toHaveTextContent("Abierta hace 12 minutos");
    expect(screen.getByRole("link", { name: "Abrir cuenta de Mario" })).toHaveTextContent("Para llevar: Mario");
    expect(screen.queryByRole("link", { name: "Abrir cuenta de 5" })).not.toBeInTheDocument();
  });

  it("administración ve las de todos los meseros", async () => {
    renderWithProviders(<Harness scope="all" />);

    expect(await screen.findByRole("link", { name: "Abrir cuenta de 5" })).toHaveAttribute("href", "/es/pedido?cuenta=32&from=ordenes");
    expect(screen.getByText("Atiende Luis", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("no repite la palabra Mesa cuando la mesa ya se llama así", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue({ ...overview, results: [{ ...overview.results[0], name: "Mesa 4" }] });
    renderWithProviders(<Harness scope="all" />);

    const link = await screen.findByRole("link", { name: "Abrir cuenta de Mesa 4" });
    expect(link).toHaveTextContent("Mesa 4");
    expect(link).not.toHaveTextContent("Mesa Mesa 4");
  });

  it("no pinta nada si no hay cuentas abiertas", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue({ ...overview, results: [{ ...overview.results[2] }], takeouts: [] });
    renderWithProviders(<Harness scope="all" />);

    await vi.waitFor(() => expect(restaurantService.overview).toHaveBeenCalled());
    expect(screen.queryByText("Cuentas abiertas")).not.toBeInTheDocument();
  });

  it("no pinta nada sin mesas dadas de alta (modo servicio)", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue({ results: [], takeouts: [], ready_items: [] });
    renderWithProviders(<Harness scope="all" />);

    await vi.waitFor(() => expect(restaurantService.overview).toHaveBeenCalled());
    expect(screen.queryByText("Cuentas abiertas")).not.toBeInTheDocument();
  });
});

describe("ClosedChecks", () => {
  function ClosedHarness({ scope }: { scope: "all" | "mine" }) {
    const checks = useClosedChecks(scope);
    return <ClosedChecks checks={checks} from="ordenes" title="Cobradas hoy" />;
  }

  it("lista las cobradas de hoy y cada una abre su hoja con el ticket", async () => {
    renderWithProviders(<ClosedHarness scope="all" />);

    const table = await screen.findByRole("link", { name: "Ver cuenta cobrada de 2" });
    expect(table).toHaveAttribute("href", "/es/pedido?cuenta=40&hoja=1&from=ordenes");
    expect(table).toHaveTextContent("Mesa 2");
    expect(table).toHaveTextContent("$380.00");
    expect(table).toHaveTextContent("Atiende Sara");
    expect(screen.getByRole("link", { name: "Ver cuenta cobrada de Eva" })).toHaveTextContent("Para llevar: Eva");
    expect(screen.getByRole("heading", { name: /Cobradas hoy/ })).toHaveTextContent("(2)");
  });

  it("el operador ve solo las suyas", async () => {
    renderWithProviders(<ClosedHarness scope="mine" />);

    expect(await screen.findByRole("link", { name: "Ver cuenta cobrada de 2" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver cuenta cobrada de Eva" })).not.toBeInTheDocument();
  });
});
