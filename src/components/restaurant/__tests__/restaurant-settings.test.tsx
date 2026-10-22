import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { DiningTable, Station } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/services/restaurant", () => ({
  restaurantService: {
    stations: vi.fn(),
    overview: vi.fn(),
    createStation: vi.fn(),
    updateStation: vi.fn(),
    tables: vi.fn(),
    createTable: vi.fn(),
    updateTable: vi.fn(),
    openCheck: vi.fn(),
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
  id, name, kind: "kitchen", is_default: false, active: true, position: id, ...extra,
});
const table = (id: number, name: string, active = true): DiningTable => ({ id, name, active, position: id });

beforeEach(() => {
  vi.clearAllMocks();
  locked = false;
  vi.mocked(restaurantService.stations).mockResolvedValue([station(1, "Cocina", { is_default: true }), station(2, "Barra", { active: false })]);
  vi.mocked(restaurantService.tables).mockResolvedValue([table(1, "1"), table(2, "2", false)]);
  vi.mocked(restaurantService.stockAlerts).mockResolvedValue([]);
  vi.mocked(restaurantService.overview).mockResolvedValue({ results: [{ ...table(1, "1"), check: null }], takeouts: [], ready_items: [] });
  vi.mocked(restaurantService.createStation).mockResolvedValue(station(3, "Parrilla"));
  vi.mocked(restaurantService.createTable).mockResolvedValue(table(3, "3"));
  vi.mocked(restaurantService.updateStation).mockResolvedValue(station(2, "Barra"));
});

/** Abre la pestaña Configuración (el dueño y el administrador la tienen). */
async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("tab", { name: "Configuración" }));
}

describe("configuración del restaurante", () => {
  beforeEach(() => useAuthStore.setState({ selectedCompanyId: 1, role: "owner" } as never));

  it("ofrece Tomar pedido con mesas activas y lo lleva con el origen", async () => {
    renderWithProviders(<RestaurantePage />);

    const link = await screen.findByRole("link", { name: "Tomar pedido" });
    expect(link).toHaveAttribute("href", "/es/pedido?from=restaurante");
  });

  it("no ofrece Tomar pedido si no hay mesas activas", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue({ results: [], takeouts: [], ready_items: [] });
    renderWithProviders(<RestaurantePage />);

    expect(await screen.findByText("Aún no hay mesas")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tomar pedido" })).not.toBeInTheDocument();
  });

  it("lista las estaciones con su insignia y el enlace a su pantalla", async () => {
    renderWithProviders(<RestaurantePage />);
    await openSettings(userEvent.setup());

    expect(await screen.findByText("Cocina", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Predeterminada")).toBeInTheDocument();
    expect(screen.getAllByText("Inactiva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cocina").length).toBeGreaterThan(1);
    const links = screen.getAllByRole("link", { name: /Abrir pantalla/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/es/estacion/1");
  });

  it("lista las mesas y marca las inactivas", async () => {
    renderWithProviders(<RestaurantePage />);
    await openSettings(userEvent.setup());

    expect(await screen.findByRole("button", { name: "Editar mesa: 1" })).toBeInTheDocument();
    expect(screen.getByText("2")).toHaveClass("line-through");
    expect(screen.getByText("Inactiva", { selector: "span.shrink-0" })).toBeInTheDocument();
  });

  it("crea una estación", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();
    await openSettings(user);

    await user.click(await screen.findByRole("button", { name: "Nueva estación" }));
    await user.type(await screen.findByLabelText("Nombre"), "Parrilla");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(restaurantService.createStation).toHaveBeenCalledWith({ name: "Parrilla", kind: "kitchen", is_default: false, active: true }),
    );
  });

  it("no guarda una estación sin nombre", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();
    await openSettings(user);

    await user.click(await screen.findByRole("button", { name: "Nueva estación" }));
    await user.click(await screen.findByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Escribe un nombre")).toBeInTheDocument();
    expect(restaurantService.createStation).not.toHaveBeenCalled();
  });

  it("edita una estación con sus datos actuales", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();
    await openSettings(user);

    await user.click(await screen.findByRole("button", { name: "Editar estación: Barra" }));
    const name = await screen.findByLabelText("Nombre");
    expect(name).toHaveValue("Barra");
    await user.clear(name);
    await user.type(name, "Bar");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(restaurantService.updateStation).toHaveBeenCalledWith(2, { name: "Bar", kind: "kitchen", is_default: false, active: false }),
    );
  });

  it("crea una mesa", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();
    await openSettings(user);

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
    await openSettings(userEvent.setup());

    expect(await screen.findByText("Cerveza")).toBeInTheDocument();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByText("Quedan pocas")).toBeInTheDocument();
    expect(screen.getByText("2 de mínimo 3")).toBeInTheDocument();
  });

  it("sin alertas lo dice", async () => {
    renderWithProviders(<RestaurantePage />);
    await openSettings(userEvent.setup());

    expect(await screen.findByText("Sin alertas de existencias")).toBeInTheDocument();
  });

  it("el dueño ve las pestañas Servicio y Configuración; el gerente solo el servicio", async () => {
    const { unmount } = renderWithProviders(<RestaurantePage />);
    expect(await screen.findByRole("tab", { name: "Servicio" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Configuración" })).toBeInTheDocument();
    unmount();

    useAuthStore.setState({ role: "manager" } as never);
    renderWithProviders(<RestaurantePage />);
    expect(await screen.findByText("Plano del servicio")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Configuración" })).not.toBeInTheDocument();
  });

  it("elige el tipo de estación al crearla", async () => {
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();

    await openSettings(user);
    await user.click(await screen.findByRole("button", { name: "Nueva estación" }));
    await user.type(await screen.findByLabelText("Nombre"), "Bar");
    await user.click(screen.getByRole("radio", { name: "Barra" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(restaurantService.createStation).toHaveBeenCalledWith({ name: "Bar", kind: "bar", is_default: false, active: true }),
    );
  });

  it("mover una mesa renumera solo las posiciones que cambian", async () => {
    vi.mocked(restaurantService.tables).mockResolvedValue([table(1, "1"), table(2, "2")]);
    vi.mocked(restaurantService.updateTable).mockResolvedValue(table(1, "1"));
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();

    await openSettings(user);
    await user.click(await screen.findByRole("button", { name: "Mover después: 1" }));

    await waitFor(() => expect(restaurantService.updateTable).toHaveBeenCalledTimes(2));
    expect(restaurantService.updateTable).toHaveBeenCalledWith(2, { position: 1 });
    expect(restaurantService.updateTable).toHaveBeenCalledWith(1, { position: 2 });
  });

  it("sin mesas guía a crear la primera", async () => {
    vi.mocked(restaurantService.tables).mockResolvedValue([]);
    renderWithProviders(<RestaurantePage />);
    const user = userEvent.setup();

    await openSettings(user);
    expect(await screen.findByText(/Agrega tu primera mesa/)).toBeInTheDocument();
  });

  it("si el plan no incluye el módulo muestra el bloqueo y no consulta nada", () => {
    locked = true;
    renderWithProviders(<RestaurantePage />);

    expect(screen.getByText("Módulo bloqueado")).toBeInTheDocument();
    expect(restaurantService.stations).not.toHaveBeenCalled();
  });
});
