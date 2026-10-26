import { fireEvent, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import { DEMO_EXPIRED_EVENT } from "@/lib/demo";
import type { User } from "@/types";

vi.mock("@/services/demo", () => ({ demoService: { finish: vi.fn(), open: vi.fn(), resolveInvite: vi.fn() } }));

import { demoService } from "@/services/demo";
import { DemoBanner } from "./demo-banner";

const userIn = (demo: boolean) =>
  ({ id: 1, companies: [{ id: 9, name: "Demo", slug: "d", role: "owner", parent_company_id: null, order_mode: "order", demo }] }) as unknown as User;

const endSession = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("draxuvo_demo", JSON.stringify({ plan: "pro", scenario: "pro_restaurant", expiresAt: "2099-01-01T00:00:00Z" }));
  useAuthStore.setState({ user: userIn(true), selectedCompanyId: 9, role: "owner", endSession });
});

afterEach(() => vi.useRealTimers());

describe("DemoBanner", () => {
  it("avisa que es una demostración, con el plan y las dos salidas", () => {
    renderWithProviders(<DemoBanner />);

    expect(screen.getByRole("status")).toHaveTextContent("Estás en una demostración del plan Pro");
    expect(screen.getByRole("button", { name: "Crear mi cuenta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir de la demo" })).toBeInTheDocument();
  });

  it("no aparece en una empresa real", () => {
    useAuthStore.setState({ user: userIn(false) });
    renderWithProviders(<DemoBanner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("«Crear mi cuenta» termina la demo como signup y abre el registro con el plan que se probaba", async () => {
    vi.mocked(demoService.finish).mockResolvedValue(undefined);
    renderWithProviders(<DemoBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));

    await waitFor(() => expect(demoService.finish).toHaveBeenCalledWith("signup"));
    await waitFor(() => expect(endSession).toHaveBeenCalledWith("/registro?plan=pro"));
    expect(localStorage.getItem("draxuvo_demo")).toBeNull();
  });

  it("«Salir de la demo» la termina como left y sale al sitio", async () => {
    vi.mocked(demoService.finish).mockResolvedValue(undefined);
    renderWithProviders(<DemoBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Salir de la demo" }));

    await waitFor(() => expect(demoService.finish).toHaveBeenCalledWith("left"));
    await waitFor(() => expect(endSession).toHaveBeenCalledWith("/login"));
  });

  it("si la demo ya venció y la API rechaza terminarla, igual cierra la sesión y sigue", async () => {
    vi.mocked(demoService.finish).mockRejectedValue(new Error("demo_expired"));
    renderWithProviders(<DemoBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Crear mi cuenta" }));

    await waitFor(() => expect(endSession).toHaveBeenCalledWith("/registro?plan=pro"));
  });
});

describe("DemoExpired", () => {
  it("al recibir demo_expired de la API bloquea la pantalla con las dos salidas", async () => {
    renderWithProviders(<DemoBanner />);
    expect(screen.queryByText("Tu demostración terminó")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(DEMO_EXPIRED_EVENT));
    });

    expect(await screen.findByText("Tu demostración terminó")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir otra demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear mi cuenta", hidden: false })).toBeInTheDocument();
  });

  it("salta sola cuando llega la hora en que termina la demo", async () => {
    vi.useFakeTimers();
    localStorage.setItem("draxuvo_demo", JSON.stringify({ plan: "pro", scenario: "pro_restaurant", expiresAt: new Date(Date.now() + 60_000).toISOString() }));
    renderWithProviders(<DemoBanner />);
    expect(screen.queryByText("Tu demostración terminó")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByText("Tu demostración terminó")).toBeInTheDocument();
  });

  it("«Abrir otra demo» limpia la sesión y vuelve a la elección del plan", async () => {
    vi.mocked(demoService.finish).mockRejectedValue(new Error("demo_expired"));
    renderWithProviders(<DemoBanner />);
    act(() => {
      window.dispatchEvent(new Event(DEMO_EXPIRED_EVENT));
    });

    fireEvent.click(await screen.findByRole("button", { name: "Abrir otra demo" }));

    await waitFor(() => expect(endSession).toHaveBeenCalledWith("/demo?plan=pro"));
  });
});
