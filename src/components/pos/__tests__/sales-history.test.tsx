import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Sale } from "@/types";

const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/es/ventas",
  useSearchParams: () => search.params,
}));
vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn().mockResolvedValue({ active_modules: ["inventory", "pos"] }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/services/sales", () => ({ salesService: { list: vi.fn(), get: vi.fn(), cancel: vi.fn(), ticketPdf: vi.fn(), sendTicketWhatsapp: vi.fn() } }));

import { toast } from "sonner";
import { salesService } from "@/services/sales";
import { SalesHistory } from "../sales-history";

const ticket = {
  id: 9, folio: "T-000009", status: "paid", payment_method: "cash", amount_received: "100.00", change_given: "15.00", total: "85.00", paid_at: "2026-11-03T10:00:00Z",
  charged_by: null, voided_at: null, voided_by: null, void_reason: null, payments: [{ id: 1, method: "cash", amount: "85.00", amount_received: "100.00", change_given: "15.00", reference: null }],
};

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 7, status: "paid", status_label: "Cobrada", total: "85.00", items_count: 1, opened_by: { id: 3, name: "Ana Pérez" }, charged_by: { id: 3, name: "Ana Pérez" },
  paid_at: "2026-11-03T10:00:00Z", cancelled_at: null, cancelled_by: null, cancel_reason: null, lock_version: 3, created_at: "2026-11-03T09:58:00Z", folio: "T-000009",
  actions: ["ticket", "cancel"], items: [{ id: 1, product_id: 10, name: "Cuaderno profesional", sku: "PAP-001", unit_price: "42.50", quantity: 2, subtotal: "85.00", icon: null, stock: 16, fractional: false }],
  ticket: ticket as never, whatsapp_available: false, ...over,
});

const page = (results: Sale[]) => ({ info: { page_size: 20, page_index: 1, total: results.length, page_start: 1, page_end: results.length, pages_total: 1 }, results });

beforeEach(() => {
  vi.resetAllMocks();
  search.params = new URLSearchParams();
  useAuthStore.setState({ selectedCompanyId: 1, role: "owner", user: { id: 1, role: "owner", companies: [] } as never });
  vi.mocked(salesService.list).mockResolvedValue(page([sale()]) as never);
  vi.mocked(salesService.get).mockResolvedValue(sale());
});

describe("historial de ventas (spec 050)", () => {
  it("lista las ventas con folio, artículos, cajero, total y estado", async () => {
    renderWithProviders(<SalesHistory />);
    const row = await screen.findByRole("button", { name: /T-000009/ });
    expect(row).toHaveTextContent("1 artículo");
    expect(row).toHaveTextContent("Cajero: Ana Pérez");
    expect(row).toHaveTextContent("$85.00");
    expect(row).toHaveTextContent("Cobrada");
  });

  it("el personal ve el título de sus ventas", async () => {
    renderWithProviders(<SalesHistory mine />);
    expect(await screen.findByRole("heading", { name: "Mis ventas" })).toBeInTheDocument();
  });

  it("pide la lista con los filtros de la URL", async () => {
    search.params = new URLSearchParams("status=cancelled&from=2026-11-01&search=cuaderno");
    renderWithProviders(<SalesHistory />);
    await waitFor(() =>
      expect(salesService.list).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled", from: "2026-11-01", search: "cuaderno", page: 1 })),
    );
  });

  it("sin ventas lo dice", async () => {
    vi.mocked(salesService.list).mockResolvedValue(page([]) as never);
    renderWithProviders(<SalesHistory />);
    expect(await screen.findByText("Todavía no hay ventas.")).toBeInTheDocument();
  });

  it("sin el módulo muestra el bloqueo del plan", async () => {
    vi.mocked(salesService.list).mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { error: { details: { code: "module_not_in_plan", module: "pos" } } } },
    });
    renderWithProviders(<SalesHistory />);
    expect(await screen.findByRole("heading", { name: /no está en tu plan/i })).toBeInTheDocument();
  });

  it("abrir una venta muestra artículos, pagos y el ticket", async () => {
    renderWithProviders(<SalesHistory />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /T-000009/ }));

    const dialog = await screen.findByRole("dialog", { name: "Venta 7" });
    expect(within(dialog).getByText("Cuaderno profesional")).toBeInTheDocument();
    expect(within(dialog).getByText("Efectivo")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
  });

  it("dueño y administrador cancelan con motivo obligatorio", async () => {
    vi.mocked(salesService.cancel).mockResolvedValue(sale({ status: "cancelled", status_label: "Cancelada", cancel_reason: "Cliente devolvió", actions: ["ticket"] }));
    renderWithProviders(<SalesHistory />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /T-000009/ }));
    await user.click(await screen.findByRole("button", { name: "Cancelar venta" }));

    await user.click(screen.getAllByRole("button", { name: "Cancelar venta" }).at(-1) as HTMLElement);
    expect(await screen.findByText("Escribe el motivo.")).toBeInTheDocument();
    expect(salesService.cancel).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Motivo de la cancelación"), "Cliente devolvió");
    await user.click(screen.getAllByRole("button", { name: "Cancelar venta" }).at(-1) as HTMLElement);

    await waitFor(() => expect(salesService.cancel).toHaveBeenCalledWith(7, "Cliente devolvió"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Venta cancelada"));
  });

  it("el staff no ve el botón de cancelar", async () => {
    vi.mocked(salesService.get).mockResolvedValue(sale({ actions: ["ticket"] }));
    renderWithProviders(<SalesHistory mine />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /T-000009/ }));

    await screen.findByRole("dialog", { name: "Venta 7" });
    expect(screen.queryByRole("button", { name: "Cancelar venta" })).not.toBeInTheDocument();
  });

  it("una venta cancelada se ve marcada en su ticket", async () => {
    vi.mocked(salesService.get).mockResolvedValue(
      sale({ status: "cancelled", status_label: "Cancelada", cancel_reason: "Error de captura", cancelled_by: { id: 2, name: "Luis" }, actions: ["ticket"] }),
    );
    renderWithProviders(<SalesHistory />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /T-000009/ }));

    expect(await screen.findByText(/Venta cancelada · Motivo: Error de captura/)).toBeInTheDocument();
    expect(screen.getByText(/Cancelada por Luis/)).toBeInTheDocument();
  });

  it("una venta abierta aparece como sin cobrar", async () => {
    vi.mocked(salesService.list).mockResolvedValue(page([sale({ status: "open", status_label: "Abierta", folio: null, paid_at: null, ticket: null })]) as never);
    renderWithProviders(<SalesHistory />);
    expect(await screen.findByRole("button", { name: /#7/ })).toHaveTextContent("Sin cobrar");
  });
});
