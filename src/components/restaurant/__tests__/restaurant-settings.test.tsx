import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { DiningTable, Station } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/restaurant", () => ({
  restaurantService: {
    stations: vi.fn(),
    createStation: vi.fn(),
    updateStation: vi.fn(),
    tables: vi.fn(),
    createTable: vi.fn(),
    updateTable: vi.fn(),
    stockAlerts: vi.fn(),
  },
}));
let locked = false;
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: () => ({ enabled: !locked, isLocked: () => locked }),
  ModuleLocked: () => <p>Módulo bloqueado</p>,
}));

import { restaurantService } from "@/services/restaurant";
import RestaurantePage from "@/app/[locale]/(dashboard)/restaurante/page";

const station = (id: number, name: string, extra: Partial<Station> = {}): Station => ({
  id, name, is_default: false, active: true, position: id, ...extra,
});
const table = (id: number, name: string, active = true): DiningTable => ({ id, name, active, position: id });

beforeEach(() => {
  vi.clearAllMocks();
  locked = false;
  vi.mocked(restaurantService.stations).mockResolvedValue([station(1, "Cocina", { is_default: true }), station(2, "Barra", { active: false })]);
  vi.mocked(restaurantService.tables).mockResolvedValue([table(1, "1"), table(2, "2", false)]);
  vi.mocked(restaurantService.stockAlerts).mockResolvedValue([]);
  vi.mocked(restaurantService.createStation).mockResolvedValue(station(3, "Parrilla"));
  vi.mocked(restaurantService.createTable).mockResolvedValue(table(3, "3"));
  vi.mocked(restaurantService.updateStation).mockResolvedValue(station(2, "Barra"));
});

describe("configuración del restaurante", () => {
  it("lista las estaciones con su insignia y el enlace a su pantalla", async () => {
    renderWithProviders(<RestaurantePage />);

    expect(await screen.findByText("Cocina")).toBeInTheDocument();
    expect(screen.getByText("Predeterminada")).toBeInTheDocument();
    expect(screen.getByText("Inactiva")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Abrir pantalla/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/es/estacion/1");
  });

  it("lista las mesas y marca las inactivas", async () => {
    renderWithProviders(<RestaurantePage />);

    expect(await screen.findByRole("button", { name: "Editar mesa: 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar mesa: 2" })).toHaveClass("line-through");
  });

  it("crea una estación", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Nueva estación" }));
    await user.type(await screen.findByLabelText("Nombre"), "Parrilla");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(restaurantService.createStation).toHaveBeenCalledWith({ name: "Parrilla", is_default: false, active: true }),
    );
  });

  it("no guarda una estación sin nombre", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Nueva estación" }));
    await user.click(await screen.findByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Escribe un nombre")).toBeInTheDocument();
    expect(restaurantService.createStation).not.toHaveBeenCalled();
  });

  it("edita una estación con sus datos actuales", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Editar estación: Barra" }));
    const name = await screen.findByLabelText("Nombre");
    expect(name).toHaveValue("Barra");
    await user.clear(name);
    await user.type(name, "Bar");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(restaurantService.updateStation).toHaveBeenCalledWith(2, { name: "Bar", is_default: false, active: false }),
    );
  });

  it("crea una mesa", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Nueva mesa" }));
    await user.type(await screen.findByLabelText("Nombre o número"), "3");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(restaurantService.createTable).toHaveBeenCalledWith({ name: "3", active: true }));
  });

  it("muestra las alertas de inventario con agotado y quedan pocas", async () => {
    vi.mocked(restaurantService.stockAlerts).mockResolvedValue([
      { id: 1, name: "Cerveza", stock: 0, min_stock: 12, sold_out: true },
      { id: 2, name: "Cola", stock: 2, min_stock: 3, sold_out: false },
    ]);
    renderWithProviders(<RestaurantePage />);

    expect(await screen.findByText("Cerveza")).toBeInTheDocument();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByText("Quedan pocas")).toBeInTheDocument();
    expect(screen.getByText("2 de mínimo 3")).toBeInTheDocument();
  });

  it("sin alertas lo dice", async () => {
    renderWithProviders(<RestaurantePage />);

    expect(await screen.findByText("Sin alertas de existencias")).toBeInTheDocument();
  });

  it("si el plan no incluye el módulo muestra el bloqueo y no consulta nada", () => {
    locked = true;
    renderWithProviders(<RestaurantePage />);

    expect(screen.getByText("Módulo bloqueado")).toBeInTheDocument();
    expect(restaurantService.stations).not.toHaveBeenCalled();
  });
});
