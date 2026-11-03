import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

const nav = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => "/es/ordenes",
  useSearchParams: () => new URLSearchParams(nav.query),
}));
const gate = vi.hoisted(() => ({ locked: false }));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: () => ({ enabled: !gate.locked, isLocked: () => gate.locked }),
  ModuleLocked: () => <p>Módulo bloqueado</p>,
}));
vi.mock("@/services/tickets", () => ({ ticketsService: { list: vi.fn(), getById: vi.fn() } }));
vi.mock("@/services/analytics", () => ({ getDashboardStats: vi.fn() }));
vi.mock("@/components/tickets/ticket-detail", () => ({
  TicketDetail: ({ ticket, onClose }: { ticket: { folio: string }; onClose: () => void }) => (
    <div role="dialog" aria-label="Detalle">
      {ticket.folio}
      <button onClick={onClose}>Cerrar detalle</button>
    </div>
  ),
}));

import { ticketsService } from "@/services/tickets";
import { getDashboardStats } from "@/services/analytics";
import { PaidList } from "./paid-list";

const base = { status: "paid", total: "120.00", created_at: "2026-11-02T10:00:00Z", payment_method: "cash" };
const order = { ...base, id: 1, folio: "T-000001", work_order: { id: 3, title: "Cambio de pantalla", employee: { id: 2, name: "Luis" } }, check: null };
const mesa = { ...base, id: 2, folio: "T-000002", work_order: null, check: { id: 9, table: "3", takeout_name: null, waiter: { id: 1, name: "Sara" } } };
const info = (total: number) => ({ total, page_index: 1, page_end: total, page_size: 20 });

beforeEach(() => {
  vi.clearAllMocks();
  nav.query = "";
  gate.locked = false;
  useAuthStore.setState({ role: "owner", selectedCompanyId: 1 } as never);
  vi.mocked(ticketsService.list).mockResolvedValue({ results: [order, mesa], info: info(2) } as never);
  vi.mocked(getDashboardStats).mockResolvedValue({ tickets: { total: 7, pending: 2, paid: 4, voided: 1 } } as never);
});

describe("PaidList", () => {
  it("lista tickets de órdenes y de mesas con sus conteos por estado", async () => {
    renderWithProviders(<PaidList variant="boss" />);

    expect(await screen.findByText("T-000001")).toBeInTheDocument();
    expect(screen.getByText("Cambio de pantalla")).toBeInTheDocument();
    expect(screen.getByText("T-000002")).toBeInTheDocument();
    expect(screen.getByText("Mesa 3")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Filtrar por estado" });
    await waitFor(() => expect(group).toHaveTextContent("Anulado1"));
    expect(group).toHaveTextContent("Pendiente2");
  });

  it("la solicitud lleva el estado y la búsqueda de la URL", async () => {
    nav.query = "status=voided&search=T-1";
    renderWithProviders(<PaidList variant="boss" />);

    await screen.findByText("T-000001");
    expect(ticketsService.list).toHaveBeenCalledWith({ page: 1, page_size: 20, status: "voided", search: "T-1" });
  });

  it("cambiar de ficha escribe el estado en la URL conservando la vista y sin página", async () => {
    nav.query = "vista=cobradas&page=3";
    renderWithProviders(<PaidList variant="boss" />);

    await userEvent.click(await screen.findByRole("button", { name: /^Cobrado/ }));
    expect(nav.replace).toHaveBeenLastCalledWith("/es/ordenes?vista=cobradas&status=paid", { scroll: false });
  });

  it("un estado inválido en la URL se ignora", async () => {
    nav.query = "status=otro";
    renderWithProviders(<PaidList variant="boss" />);

    await screen.findByText("T-000001");
    expect(ticketsService.list).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("tocar una fila abre el ticket y cerrarlo no pierde los filtros", async () => {
    nav.query = "vista=cobradas&status=paid";
    renderWithProviders(<PaidList variant="boss" />);

    await userEvent.click(await screen.findByText("T-000002"));
    expect(screen.getByRole("dialog", { name: "Detalle" })).toHaveTextContent("T-000002");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("?ticket=<id> abre ese ticket al cargar y al cerrar lo quita de la URL", async () => {
    nav.query = "vista=cobradas&ticket=2";
    vi.mocked(ticketsService.getById).mockResolvedValue(mesa as never);
    renderWithProviders(<PaidList variant="boss" />);

    expect(await screen.findByRole("dialog", { name: "Detalle" })).toHaveTextContent("T-000002");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(nav.replace).toHaveBeenCalledWith("/es/ordenes?vista=cobradas", { scroll: false });
  });

  it("un ?ticket inválido se ignora", async () => {
    nav.query = "ticket=abc";
    renderWithProviders(<PaidList variant="boss" />);

    await screen.findByText("T-000001");
    expect(ticketsService.getById).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("el staff no pide conteos al tablero", async () => {
    renderWithProviders(<PaidList variant="staff" />);

    await screen.findByText("T-000001");
    expect(getDashboardStats).not.toHaveBeenCalled();
  });

  it("un ticket sin orden ni cuenta se muestra por folio y total", async () => {
    vi.mocked(ticketsService.list).mockResolvedValue({ results: [{ ...base, id: 3, folio: "T-000003", work_order: null, check: null }], info: info(1) } as never);
    renderWithProviders(<PaidList variant="boss" />);

    expect(await screen.findByText("T-000003")).toBeInTheDocument();
    expect(screen.getByText("$120.00")).toBeInTheDocument();
  });

  it("sin cobros muestra la guía; con filtros, que no hay coincidencias", async () => {
    vi.mocked(ticketsService.list).mockResolvedValue({ results: [], info: info(0) } as never);
    const { unmount } = renderWithProviders(<PaidList variant="boss" />);
    expect(await screen.findByText("Aún no hay cobros")).toBeInTheDocument();
    unmount();

    nav.query = "search=zzz";
    renderWithProviders(<PaidList variant="boss" />);
    expect(await screen.findByText("Sin resultados")).toBeInTheDocument();
  });

  it("si falla la carga ofrece Reintentar", async () => {
    vi.mocked(ticketsService.list).mockRejectedValueOnce(new Error("boom"));
    renderWithProviders(<PaidList variant="boss" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo cargar la información.");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("T-000001")).toBeInTheDocument();
  });

  it("sin el módulo muestra el bloqueo y no hace solicitudes", () => {
    gate.locked = true;
    renderWithProviders(<PaidList variant="boss" />);

    expect(screen.getByText("Módulo bloqueado")).toBeInTheDocument();
    expect(ticketsService.list).not.toHaveBeenCalled();
  });
});
