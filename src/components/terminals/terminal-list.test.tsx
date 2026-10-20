import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { PaymentTerminal } from "@/types";
import { TerminalList } from "./terminal-list";

const updateMutate = vi.hoisted(() => vi.fn());
const deleteMutate = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-payment-terminals", () => ({
  useUpdateTerminal: () => ({ mutateAsync: updateMutate, isPending: false }),
  useDeleteTerminal: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const conCobros: PaymentTerminal = { id: 1, name: "BBVA caja 1", provider: "bbva", provider_label: "BBVA", active: true, payments_count: 3 };
const sinCobros: PaymentTerminal = { id: 2, name: "Clip vieja", provider: "clip", provider_label: "Clip", active: false, payments_count: 0 };

beforeEach(() => {
  updateMutate.mockReset().mockResolvedValue({});
  deleteMutate.mockReset().mockResolvedValue({});
});

describe("TerminalList", () => {
  it("con cobros ofrece desactivar en lugar de borrar", async () => {
    renderWithProviders(<TerminalList terminals={[conCobros, sinCobros]} onEdit={() => {}} />);
    expect(screen.getByText("BBVA · 3 cobros")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Borrar BBVA caja 1" }));
    expect(screen.getByText("La terminal tiene cobros")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(updateMutate).toHaveBeenCalledWith({ id: 1, data: { active: false } });
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("sin cobros la borra, y una desactivada se puede activar", async () => {
    renderWithProviders(<TerminalList terminals={[sinCobros]} onEdit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Activar" }));
    expect(updateMutate).toHaveBeenCalledWith({ id: 2, data: { active: true } });

    await userEvent.click(screen.getByRole("button", { name: "Borrar Clip vieja" }));
    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(deleteMutate).toHaveBeenCalledWith(2);
  });
});
