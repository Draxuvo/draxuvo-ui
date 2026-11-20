import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { CancelledCheckSummary } from "@/types";

vi.mock("@/services/restaurant", () => ({ restaurantService: { cancelledChecks: vi.fn() } }));

import { restaurantService } from "@/services/restaurant";
import { useCancelledChecks } from "@/hooks/use-restaurant";
import { CancelledChecks } from "../cancelled-checks";

const row = (over: Partial<CancelledCheckSummary> = {}): CancelledCheckSummary => ({
  id: 26, table: { id: 25, name: "4" }, takeout_name: null, waiter: { id: 1, name: "Sara" },
  opened_at: "2026-11-16T22:53:56Z", cancelled_at: "2026-11-19T20:09:54Z", cancel_reason: "Se fueron",
  cancelled_by: { id: 2, name: "Ana" }, cancelled_items: 7, mine: false, ...over,
});

const page = (results: CancelledCheckSummary[], { total = results.length, index = 1, end = results.length } = {}) => ({
  info: { page_size: 20, page_index: index, total, page_start: 1, page_end: end, pages_total: 1 }, results,
});

function Harness() {
  const query = useCancelledChecks({ search: "mesa" });
  return <CancelledChecks query={query} from="ordenes" />;
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ selectedCompanyId: 1, role: "owner" } as never);
});

describe("CancelledChecks (spec 070)", () => {
  it("lista mesa, para llevar, mesero, motivo, renglones y quién canceló, y abre la hoja", async () => {
    vi.mocked(restaurantService.cancelledChecks).mockResolvedValue(page([
      row(),
      row({ id: 19, table: null, takeout_name: "Rosa", cancel_reason: null, cancelled_by: null, cancelled_items: 0 }),
    ]));
    renderWithProviders(<Harness />);

    const table = await screen.findByRole("link", { name: "Ver cuenta cancelada de Mesa 4" });
    expect(table).toHaveAttribute("href", "/es/pedido?cuenta=26&hoja=1&from=ordenes");
    expect(table).toHaveTextContent("Atiende Sara");
    expect(table).toHaveTextContent("Se fueron · 7 renglones cancelados · Canceló: Ana");
    const takeout = screen.getByRole("link", { name: "Ver cuenta cancelada de Para llevar: Rosa" });
    expect(takeout).toHaveTextContent("Sin motivo · Sin renglones");
    expect(takeout).not.toHaveTextContent("Canceló");
    expect(screen.getByRole("heading", { name: "Cuentas canceladas (2)" })).toBeInTheDocument();
    expect(restaurantService.cancelledChecks).toHaveBeenCalledWith({ search: "mesa", page: 1, page_size: 20 });
  });

  it("una mesa sin nombre se muestra como eliminada", async () => {
    vi.mocked(restaurantService.cancelledChecks).mockResolvedValue(page([row({ table: null, takeout_name: null })]));
    renderWithProviders(<Harness />);

    expect(await screen.findByRole("link", { name: "Ver cuenta cancelada de Mesa eliminada" })).toBeInTheDocument();
  });

  it("carga la siguiente página con «Cargar más»", async () => {
    vi.mocked(restaurantService.cancelledChecks)
      .mockResolvedValueOnce(page([row()], { total: 2, end: 1 }))
      .mockResolvedValueOnce(page([row({ id: 21, table: { id: 3, name: "Mesa 9" } })], { total: 2, index: 2, end: 2 }));
    renderWithProviders(<Harness />);

    await userEvent.click(await screen.findByRole("button", { name: "Cargar más" }));

    expect(await screen.findByRole("link", { name: "Ver cuenta cancelada de Mesa 9" })).toBeInTheDocument();
    expect(restaurantService.cancelledChecks).toHaveBeenLastCalledWith({ search: "mesa", page: 2, page_size: 20 });
    expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
  });

  it("sin canceladas no pinta nada y con error ofrece reintentar", async () => {
    vi.mocked(restaurantService.cancelledChecks).mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(page([]));
    renderWithProviders(<Harness />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las cuentas canceladas.");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText((_, el) => el?.tagName === "BODY" && !el.textContent?.includes("No se pudieron"));
    expect(screen.queryByRole("heading", { name: /Cuentas canceladas/ })).not.toBeInTheDocument();
  });
});
