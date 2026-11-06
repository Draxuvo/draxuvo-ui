import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn() }));
vi.mock("@/services/charge-queue", () => ({ chargeQueueService: { get: vi.fn() } }));

import { getSubscription } from "@/services/subscription";
import { chargeQueueService } from "@/services/charge-queue";
import { ChargeQueueChip } from "./charge-queue-chip";

const as = (role: "owner" | "admin" | "staff", bossOnly = true) =>
  useAuthStore.setState({
    user: { id: 1, role, companies: [{ id: 5, role, name: "Volta", boss_only_charge: bossOnly }] } as never,
    selectedCompanyId: 5,
    role,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSubscription).mockResolvedValue({ boss_only_charge: true } as never);
  vi.mocked(chargeQueueService.get).mockResolvedValue({ enabled: true, sales: 2, work_orders: 1, checks: 0, total: 3 });
});

describe("contador «Por cobrar» (spec 058)", () => {
  it("el dueño ve el total y los enlaces de lo que tiene pendiente", async () => {
    as("owner");
    renderWithProviders(<ChargeQueueChip />);

    const chip = await screen.findByRole("button", { name: "Por cobrar: 3" });
    await userEvent.setup().click(chip);
    expect(await screen.findByRole("menuitem", { name: /Ventas pasadas a cobro/ })).toHaveAttribute("href", "/es/venta?vista=por-cobrar");
    expect(screen.getByRole("menuitem", { name: /Órdenes terminadas/ })).toHaveAttribute("href", "/es/ordenes");
    expect(screen.queryByRole("menuitem", { name: /Mesas con cobro pedido/ })).not.toBeInTheDocument();
  });

  it("el personal no lo ve ni consulta la cola", async () => {
    as("staff");
    renderWithProviders(<ChargeQueueChip />);
    await waitFor(() => expect(chargeQueueService.get).not.toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Por cobrar/ })).not.toBeInTheDocument();
  });

  it("con la opción apagada no se pinta ni consulta la cola", async () => {
    as("admin", false);
    vi.mocked(getSubscription).mockResolvedValue({ boss_only_charge: false } as never);
    renderWithProviders(<ChargeQueueChip />);
    await waitFor(() => expect(getSubscription).toHaveBeenCalled());
    expect(chargeQueueService.get).not.toHaveBeenCalled();
  });

  it("con la cola vacía no se pinta", async () => {
    as("admin");
    vi.mocked(chargeQueueService.get).mockResolvedValue({ enabled: true, sales: 0, work_orders: 0, checks: 0, total: 0 });
    renderWithProviders(<ChargeQueueChip />);
    await waitFor(() => expect(chargeQueueService.get).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Por cobrar/ })).not.toBeInTheDocument();
  });
});
