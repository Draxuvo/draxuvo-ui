import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { TerminalConnection } from "@/types";
import { ConnectionCard } from "./connection-card";

const authorize = vi.hoisted(() => vi.fn());
const disconnect = vi.hoisted(() => vi.fn());
const saveCredentials = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-terminal-connections", () => ({
  useAuthorizeConnection: () => ({ mutate: authorize, isPending: false }),
  useDisconnect: () => ({ mutateAsync: disconnect, isPending: false }),
  useSaveCredentials: () => ({ mutateAsync: saveCredentials, isPending: false }),
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
  saveCredentials.mockReset();
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

  describe("credenciales propias", () => {
    const ownEntry = { provider: "mercado_pago" as const, available: true, oauth: false, own_credentials: true, connection: null };
    const webhookUrl = "https://api.example.test/api/v1/webhooks/mercado_pago/abc123";

    it("guía para pegar el Access Token y luego la clave de los avisos", async () => {
      saveCredentials
        .mockResolvedValueOnce({ ...connected, auth_method: "token", webhook_url: webhookUrl, webhook_secret_present: false })
        .mockResolvedValueOnce({ ...connected, auth_method: "token", webhook_url: webhookUrl, webhook_secret_present: true });
      renderWithProviders(<ConnectionCard entry={ownEntry} />);
      expect(screen.queryByRole("button", { name: "Conectar Mercado Pago" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Conectar con mis credenciales" }));
      expect(screen.getByRole("link", { name: /Abrir Mercado Pago Developers/ })).toHaveAttribute(
        "href",
        "https://www.mercadopago.com.mx/developers/panel/app",
      );
      await userEvent.type(screen.getByLabelText("Access Token de producción"), " APP_USR-123 ");
      await userEvent.click(screen.getByRole("button", { name: "Conectar" }));
      expect(saveCredentials).toHaveBeenNthCalledWith(1, { provider: "mercado_pago", access_token: "APP_USR-123" });

      expect(await screen.findByText("Avisos de Mercado Pago (recomendado)")).toBeInTheDocument();
      expect(screen.getByText(webhookUrl)).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Clave secreta de los avisos"), "s3cret");
      await userEvent.click(screen.getByRole("button", { name: "Guardar clave" }));
      expect(saveCredentials).toHaveBeenNthCalledWith(2, { provider: "mercado_pago", access_token: "", webhook_secret: "s3cret" });
    });

    it("muestra el motivo cuando Mercado Pago no acepta el token", async () => {
      saveCredentials.mockRejectedValueOnce({
        response: { data: { error: { message: "Mercado Pago no aceptó ese Access Token" } } },
      });
      renderWithProviders(<ConnectionCard entry={ownEntry} />);
      await userEvent.click(screen.getByRole("button", { name: "Conectar con mis credenciales" }));
      await userEvent.type(screen.getByLabelText("Access Token de producción"), "APP_USR-x");
      await userEvent.click(screen.getByRole("button", { name: "Conectar" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Mercado Pago no aceptó ese Access Token");
    });

    it("conectada con credenciales propias dice si faltan los avisos y deja configurarlos", async () => {
      const own = { ...connected, auth_method: "token" as const, token_hint: "…4321", webhook_secret_present: false, webhook_url: webhookUrl };
      renderWithProviders(<ConnectionCard entry={{ ...ownEntry, connection: own }} />);
      expect(screen.getByText("Access Token: …4321")).toBeInTheDocument();
      expect(screen.getByText(/Avisos sin configurar/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Configurar avisos" }));
      expect(screen.getByText(webhookUrl)).toBeInTheDocument();
    });

    it("con las dos formas disponibles ofrece ambas", () => {
      renderWithProviders(<ConnectionCard entry={{ ...ownEntry, oauth: true }} />);
      expect(screen.getByRole("button", { name: "Conectar con mis credenciales" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Conectar Mercado Pago" })).toBeInTheDocument();
    });
  });
});
