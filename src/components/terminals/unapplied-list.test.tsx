import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { TerminalCharge } from "@/types";

vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn().mockResolvedValue({ active_modules: ["terminals"] }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/services/terminal-charges", () => ({ terminalChargesService: { list: vi.fn(), refund: vi.fn(), dismiss: vi.fn() } }));

import { toast } from "sonner";
import { terminalChargesService } from "@/services/terminal-charges";
import { useAuthStore } from "@/store/auth";
import { UnappliedList } from "./unapplied-list";

const charge = (over: Partial<TerminalCharge> = {}): TerminalCharge => ({
  id: 41, status: "unapplied", status_detail: "accredited", amount: "500.00",
  terminal: { id: 2, name: "Caja 1", provider: "mercado_pago" } as never,
  owner: { type: "work_order", id: 12, label: "Reparar fuga" }, created_by: { id: 1, name: "Ana" },
  created_at: "2026-11-20T10:00:00Z", expires_at: "2026-11-20T10:03:00Z", resolved_at: "2026-11-20T10:05:00Z",
  provider_reference: "123456789", card_last4: "4242", unapplied_reason: "already_paid", result: null, refund: null,
  allowed_actions: ["refund", "dismiss"], ...over,
});

const page = (results: TerminalCharge[]) => ({ info: { page_size: 20, page_index: 1, total: results.length, page_start: 1, page_end: results.length, pages_total: 1 }, results });

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ selectedCompanyId: 1, role: "owner", user: { id: 1, role: "owner", companies: [] } as never });
});

describe("Pagos sin aplicar (spec 069, FR-035)", () => {
  it("sin pendientes no muestra nada", async () => {
    vi.mocked(terminalChargesService.list).mockResolvedValue(page([]) as never);
    const { container } = renderWithProviders(<UnappliedList />);
    await waitFor(() => expect(terminalChargesService.list).toHaveBeenCalledWith({ status: "unapplied" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("lista el pago y lo reembolsa tras confirmar", async () => {
    vi.mocked(terminalChargesService.list).mockResolvedValue(page([charge()]) as never);
    vi.mocked(terminalChargesService.refund).mockResolvedValue(charge({ status: "refunded" }));
    renderWithProviders(<UnappliedList />);
    const user = userEvent.setup();

    expect(await screen.findByText("Pagos sin aplicar (1)")).toBeInTheDocument();
    expect(screen.getByText(/ref\. 123456789/)).toBeInTheDocument();
    expect(screen.getByText("Se aprobó cuando el cobro ya se había registrado por otra vía.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reembolsar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Se devolverán $500.00 a la tarjeta cobrada en Caja 1.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Sí, reembolsar" }));
    await waitFor(() => expect(terminalChargesService.refund).toHaveBeenCalledWith(41, expect.anything()));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Reembolso hecho"));
  });

  it("si el proveedor rechaza el reembolso muestra el motivo", async () => {
    vi.mocked(terminalChargesService.list).mockResolvedValue(page([charge()]) as never);
    vi.mocked(terminalChargesService.refund).mockRejectedValue({
      response: { data: { error: { details: { code: "refund_failed", reason: "insufficient_money_for_refund" } } } },
    });
    renderWithProviders(<UnappliedList />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Reembolsar" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sí, reembolsar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La cuenta del proveedor no tiene saldo suficiente para el reembolso.");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("marcar atendido pide confirmación", async () => {
    vi.mocked(terminalChargesService.list).mockResolvedValue(page([charge()]) as never);
    vi.mocked(terminalChargesService.dismiss).mockResolvedValue(charge({ allowed_actions: [] }));
    renderWithProviders(<UnappliedList />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Marcar atendido" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sí, marcar atendido" }));
    await waitFor(() => expect(terminalChargesService.dismiss).toHaveBeenCalledWith(41, expect.anything()));
    expect(terminalChargesService.refund).not.toHaveBeenCalled();
  });
});
