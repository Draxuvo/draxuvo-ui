import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { StationBoard as Board } from "@/types";

vi.mock("@/services/restaurant", () => ({
  restaurantService: { board: vi.fn(), advanceItem: vi.fn(), advanceOrder: vi.fn() },
}));

import { restaurantService } from "@/services/restaurant";
import { StationBoard } from "../station-board";

const board = (orders: Board["orders"] = [], station: Board["station"] = { id: 1, name: "Cocina", kind: "kitchen" }): Board => ({
  station,
  server_time: new Date().toISOString(),
  orders,
});
const order = (id: number, items: Board["orders"][number]["items"], extra: Partial<Board["orders"][number]> = {}) => ({
  id, number: 1, sent_at: new Date(Date.now() - 4.5 * 60_000).toISOString(), table: "4", takeout_name: null, waiter: "Ana", items, ...extra,
});
const taco = { id: 901, name: "Tacos al pastor", quantity: 2, note: "sin cebolla", status: "new" as const };
const sopa = { id: 902, name: "Sopa del día", quantity: 1, note: null, status: "preparing" as const };

const chime = vi.fn();
class FakeAudio {
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {});
  createOscillator = () => {
    chime();
    return { frequency: { value: 0 }, connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() };
  };
  createGain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: (n: unknown) => n });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.stubGlobal("AudioContext", FakeAudio);
  window.AudioContext = FakeAudio as never;
  vi.mocked(restaurantService.advanceItem).mockResolvedValue(undefined);
  vi.mocked(restaurantService.advanceOrder).mockResolvedValue(undefined);
});

describe("pantalla de estación", () => {
  it("sin comandas muestra el estado vacío", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board());
    renderWithProviders(<StationBoard stationId={1} />);

    expect(await screen.findByText("Sin comandas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cocina" })).toBeInTheDocument();
  });

  it("muestra la comanda con la nota visible y el tiempo transcurrido", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco, sopa])]));
    renderWithProviders(<StationBoard stationId={1} />);

    expect(await screen.findByText("Mesa 4")).toBeInTheDocument();
    expect(screen.getByText("sin cebolla")).toBeInTheDocument();
    expect(screen.getByText("4 min")).toBeInTheDocument();
    expect(screen.getByText("Mesero: Ana", { exact: false })).toBeInTheDocument();
  });

  it("prepara un artículo y lo marca listo", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco, sopa])]));
    renderWithProviders(<StationBoard stationId={1} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Preparar: Tacos al pastor/ }));
    await user.click(screen.getByRole("button", { name: /Listo: Sopa del día/ }));

    await waitFor(() => expect(restaurantService.advanceItem).toHaveBeenCalledWith(1, 901));
    expect(restaurantService.advanceItem).toHaveBeenCalledWith(1, 902);
  });

  it("marca toda la comanda de una vez", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(7, [taco, sopa])]));
    renderWithProviders(<StationBoard stationId={1} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Marcar todo" }));

    await waitFor(() => expect(restaurantService.advanceOrder).toHaveBeenCalledWith(1, 7));
  });

  it("un artículo cancelado se ve tachado y sin botón", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [{ ...taco, status: "cancelled" }])]));
    renderWithProviders(<StationBoard stationId={1} />);

    expect(await screen.findByText("Tacos al pastor", { exact: false })).toHaveClass("line-through");
    expect(screen.queryByRole("button", { name: /Preparar/ })).not.toBeInTheDocument();
  });

  it("suena solo ante una comanda nueva y solo con el sonido activado", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco])]));
    const { queryClient } = renderWithProviders(<StationBoard stationId={1} />);
    const user = userEvent.setup();
    await screen.findByText("Mesa 4");
    expect(chime).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Activar sonido" }));
    chime.mockClear();

    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco]), order(2, [sopa], { table: "5" })]));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "board", 1] });
    });

    await screen.findByText("Mesa 5");
    await waitFor(() => expect(chime).toHaveBeenCalled());
  });

  it("no suena si el sonido está apagado", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco])]));
    const { queryClient } = renderWithProviders(<StationBoard stationId={1} />);
    await screen.findByText("Mesa 4");

    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco]), order(2, [sopa], { table: "5" })]));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "board", 1] });
    });

    await screen.findByText("Mesa 5");
    expect(chime).not.toHaveBeenCalled();
  });

  it("si falla la red conserva lo que ya se veía y avisa", async () => {
    vi.mocked(restaurantService.board).mockResolvedValueOnce(board([order(1, [taco])]));
    const { queryClient } = renderWithProviders(<StationBoard stationId={1} />);
    await screen.findByText("Mesa 4");

    vi.mocked(restaurantService.board).mockRejectedValue(new Error("network"));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "board", 1] });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo actualizar");
    expect(screen.getByText("Mesa 4")).toBeInTheDocument();
  });

  it("una cuenta para llevar muestra el nombre del cliente", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco], { table: null, takeout_name: "Luis" })]));
    renderWithProviders(<StationBoard stationId={1} />);

    expect(await screen.findByText("Para llevar: Luis")).toBeInTheDocument();
  });

  it("la barra se distingue de la cocina por su tipo (spec 032)", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([], { id: 2, name: "Bar del patio", kind: "bar" }));
    renderWithProviders(<StationBoard stationId={2} />);

    expect(await screen.findByRole("heading", { name: "Bar del patio" })).toBeInTheDocument();
    expect(screen.getByText("Barra", { selector: "p" })).toBeInTheDocument();
  });

  it("el resumen cuenta comandas, artículos en preparación y la más lenta", async () => {
    const slow = order(2, [sopa], { sent_at: new Date(Date.now() - 14.5 * 60_000).toISOString() });
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco, sopa]), slow]));
    renderWithProviders(<StationBoard stationId={1} />);

    const summary = await screen.findByRole("list", { name: "Resumen de la estación" });
    await waitFor(() => expect(summary).toHaveTextContent("2 comandas"));
    expect(summary).toHaveTextContent("2 en preparación");
    expect(summary).toHaveTextContent("La más lenta: 14 min");
  });

  it("suena el tono de urgencia una sola vez al volverse atrasada", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco])]));
    const { queryClient } = renderWithProviders(<StationBoard stationId={1} />);
    const user = userEvent.setup();
    await screen.findByText("Mesa 4");
    await user.click(screen.getByRole("button", { name: "Activar sonido" }));
    chime.mockClear();

    const slow = order(2, [sopa], { table: "5", sent_at: new Date(Date.now() - 14.5 * 60_000).toISOString() });
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco]), slow]));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "board", 1] });
    });

    await screen.findByText("Mesa 5");
    await waitFor(() => expect(chime).toHaveBeenCalled());
    const calls = chime.mock.calls.length;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "board", 1] });
    });
    expect(chime.mock.calls.length).toBe(calls);
  });

  it("sin comandas el resumen está en cero y no flota ningún texto de sonido", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board());
    renderWithProviders(<StationBoard stationId={1} />);

    const summary = await screen.findByRole("list", { name: "Resumen de la estación" });
    expect(summary).toHaveTextContent("0 comandas");
    expect(summary).toHaveTextContent("Nada en preparación");
    expect(screen.queryByText(/Toca para activar el sonido/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Activar sonido/ })).toBeInTheDocument();
  });

  it("resalta la comanda nueva y las cuenta en el encabezado, sin resaltar la carga inicial", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco])]));
    const { queryClient } = renderWithProviders(<StationBoard stationId={1} />);
    await screen.findByText("Mesa 4");
    expect(screen.queryByText("1 nueva")).not.toBeInTheDocument();

    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco]), order(2, [taco], { table: "5" })]));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "board", 1] });
    });

    expect(await screen.findByRole("article", { name: /Mesa 5/ })).toHaveClass("ring-2");
    expect(await screen.findByText("1 nueva")).toBeInTheDocument();
  });

  it("el resalte se va cuando la comanda nueva empieza a prepararse", async () => {
    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco])]));
    const { queryClient } = renderWithProviders(<StationBoard stationId={1} />);
    await screen.findByText("Mesa 4");

    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco]), order(2, [taco], { table: "5" })]));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "board", 1] });
    });
    await screen.findByText("1 nueva");

    vi.mocked(restaurantService.board).mockResolvedValue(board([order(1, [taco]), order(2, [{ ...taco, status: "preparing" }], { table: "5" })]));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "board", 1] });
    });

    await waitFor(() => expect(screen.queryByText("1 nueva")).not.toBeInTheDocument());
  });
});
