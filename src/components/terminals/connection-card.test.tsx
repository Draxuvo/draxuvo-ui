import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { TerminalConnection } from "@/types";
import { ConnectionCard } from "./connection-card";

const authorize = vi.hoisted(() => vi.fn());
const disconnect = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-terminal-connections", () => ({
  useAuthorizeConnection: () => ({ mutate: authorize, isPending: false }),
  useDisconnect: () => ({ mutateAsync: disconnect, isPending: false }),
  useTerminalDevices: () => ({ data: { results: [] }, isLoading: false, isError: false }),
  useLinkTerminal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const connected: TerminalConnection = {
  id: 3, provider: "mercado_pago", status: "connected", account_label: "Taller Volta", live_mode: true,
  connected_at: "2026-11-21T10:00:00Z", disconnected_at: null, connected_by: { id: 1, name: "Ana" },
  error_code: null, error_message: null, terminals_count: 2,
};

beforeEach(() => {
  authorize.mockReset();
  disconnect.mockReset().mockResolvedValue({});
});

describe("ConnectionCard (spec 069)", () => {
  it("sin conexión ofrece conectar y lleva al proveedor", async () => {
    renderWithProviders(<ConnectionCard entry={{ provider: "mercado_pago", available: true, connection: null }} />);
    await userEvent.click(screen.getByRole("button", { name: "Conectar Mercado Pago" }));
    expect(authorize).toHaveBeenCalledWith("mercado_pago");
  });

  it("conectada muestra la cuenta y deja agregar terminales y desconectar con confirmación", async () => {
    renderWithProviders(<ConnectionCard entry={{ provider: "mercado_pago", available: true, connection: connected }} />);
    expect(screen.getByText("Cuenta: Taller Volta")).toBeInTheDocument();
    expect(screen.getByText("2 terminales ligadas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar terminal de Mercado Pago" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(screen.getByText("¿Desconectar Mercado Pago?")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Desconectar" });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(disconnect).toHaveBeenCalledWith(3);
  });

  it("con error explica el motivo y ofrece volver a conectar", () => {
    renderWithProviders(
      <ConnectionCard
        entry={{ provider: "mercado_pago", available: true, connection: { ...connected, status: "error", error_message: "El proveedor rechazó las credenciales." } }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("El proveedor rechazó las credenciales.");
    expect(screen.getByRole("button", { name: "Volver a conectar" })).toBeInTheDocument();
  });
});
