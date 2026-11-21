import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { MercadoPagoCallback } from "./mercado-pago-callback";

const params = vi.hoisted(() => ({ value: new URLSearchParams() }));
const replace = vi.hoisted(() => vi.fn());
const connect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useSearchParams: () => params.value }));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }) }));
vi.mock("@/hooks/use-terminal-connections", () => ({ useConnectCallback: () => ({ mutateAsync: connect }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  replace.mockReset();
  connect.mockReset().mockResolvedValue({ id: 3 });
});

describe("regreso de Mercado Pago (spec 069)", () => {
  it("manda el código una sola vez y vuelve a Terminales", async () => {
    params.value = new URLSearchParams("code=TG-1&state=abc");
    renderWithProviders(<MercadoPagoCallback />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/terminales"));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith({ provider: "mercado_pago", code: "TG-1", state: "abc" });
  });

  it("si el negocio canceló la autorización lo explica sin llamar a la API", async () => {
    params.value = new URLSearchParams("error=access_denied");
    renderWithProviders(<MercadoPagoCallback />);
    expect(await screen.findByText("Cancelaste la autorización en Mercado Pago.")).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
  });

  it("un state vencido muestra el motivo", async () => {
    params.value = new URLSearchParams("code=TG-1&state=old");
    connect.mockRejectedValue({ isAxiosError: true, response: { data: { error: { details: { code: "invalid_state" } } } } });
    renderWithProviders(<MercadoPagoCallback />);
    expect(await screen.findByText(/La autorización venció/)).toBeInTheDocument();
  });
});
