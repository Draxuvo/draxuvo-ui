import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { TablesResponse } from "@/types";

const nav = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
const plan = vi.hoisted(() => ({ locked: [] as string[] }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => "/es/ordenes",
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: (module: string) => ({ enabled: !plan.locked.includes(module), isLocked: () => plan.locked.includes(module) }),
  ModuleLocked: () => <p>Módulo bloqueado</p>,
}));
vi.mock("@/services/tickets", () => ({ ticketsService: { list: vi.fn(), getById: vi.fn() } }));
vi.mock("@/services/restaurant", () => ({ restaurantService: { overview: vi.fn() } }));
vi.mock("@/services/analytics", () => ({ getDashboardStats: vi.fn().mockResolvedValue({ active_modules: [] }) }));
vi.mock("@/services/employees", () => ({ employeesService: { list: vi.fn().mockResolvedValue({ results: [] }) } }));
const summary = vi.hoisted(() => ({
  data: { counts: { open: 0, in_progress: 0, done: 0, paid_today: 0, unassigned: 0 }, to_charge_total: 0 },
}));
vi.mock("@/hooks/use-work-orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-work-orders")>()),
  useWorkOrders: () => ({ data: { results: [], info: { total: 0 } }, isLoading: false, error: null }),
  useWorkOrderSummary: () => ({ data: summary.data, error: null, refetch: vi.fn(), isFetching: false }),
}));

import { restaurantService } from "@/services/restaurant";
import { ticketsService } from "@/services/tickets";
import { getDashboardStats } from "@/services/analytics";
import { employeesService } from "@/services/employees";
import OrdenesPage from "./page";

const counts = { new: 0, preparing: 0, ready: 0, delivered: 0 };
const opened = new Date(Date.now() - 10 * 60_000).toISOString();
const tables: TablesResponse = {
  results: [
    { id: 1, name: "1", active: true, position: 1, state: "occupied", check: { id: 10, opened_at: opened, total: "100.00", waiter: { id: 1, name: "Ana" }, counts, mine: true } },
    { id: 2, name: "2", active: true, position: 2, state: "to_pay", check: { id: 11, opened_at: opened, total: "80.00", waiter: { id: 1, name: "Ana" }, counts, mine: true } },
  ],
  takeouts: [],
  closed_today: [{ id: 50, name: "3", takeout_name: null, closed_at: new Date().toISOString(), ticket_id: 9, waiter: { id: 1, name: "Sara" }, total: "380.00", mine: true }],
  ready_items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  nav.query = "";
  plan.locked = [];
  vi.mocked(ticketsService.list).mockResolvedValue({ results: [], info: { total: 0, page_index: 1, page_end: 1 } } as never);
  useAuthStore.setState({
    selectedCompanyId: 1,
    role: "owner",
    user: { id: 1, role: "owner", companies: [{ id: 1, role: "owner", name: "Sazón", order_mode: "order" }] },
  } as never);
});

describe("Órdenes en un restaurante con mesas (spec 032)", () => {
  it("se llama Cuentas y separa por cobrar de abiertas, sin el grupo Sin asignar", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(tables);
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("heading", { name: "Cuentas", level: 1 })).toBeInTheDocument();
    const toPay = await screen.findByRole("heading", { name: /Por cobrar/ });
    expect(toPay.closest("section")).toHaveTextContent("Mesa 2");
    expect(toPay.closest("section")).not.toHaveTextContent("Mesa 1");
    const open = screen.getByRole("heading", { name: /^Abiertas/ });
    expect(open.closest("section")).toHaveTextContent("Mesa 1");
    // Lo cobrado hoy ya no se lista en Activas: un pie lleva a la pestaña Cobradas (spec 051).
    expect(screen.queryByRole("heading", { name: /^Cobradas hoy/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cobradas hoy: 1 · Ver cobradas" })).toHaveAttribute("href", "/es/ordenes?vista=cobradas");
    expect(screen.queryByText(/Sin asignar/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva cuenta" })).toBeInTheDocument();
  });

  it("una empresa de servicio conserva Órdenes de trabajo y sus grupos", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue({ results: [], takeouts: [], ready_items: [] });
    useAuthStore.setState({ user: { id: 1, role: "owner", companies: [{ id: 1, role: "owner", name: "Volta", order_mode: "service" }] } } as never);
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("heading", { name: "Órdenes de trabajo", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText(/Sin asignar/)).toBeInTheDocument();
  });
});

describe("Filtros de Cuentas con mesas", () => {
  it("el filtro de estado cobrado oculta las cuentas abiertas y por cobrar", async () => {
    nav.query = "status=paid";
    vi.mocked(restaurantService.overview).mockResolvedValue(tables);
    renderWithProviders(<OrdenesPage />);

    await screen.findByRole("heading", { name: "Cuentas", level: 1 });
    expect(screen.queryByRole("heading", { name: /Por cobrar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Abiertas/ })).not.toBeInTheDocument();
  });

  it("la ficha Terminada deja solo las que están por cobrar", async () => {
    nav.query = "status=done";
    vi.mocked(restaurantService.overview).mockResolvedValue(tables);
    renderWithProviders(<OrdenesPage />);

    const toPay = await screen.findByRole("heading", { name: /Por cobrar/ });
    expect(toPay.closest("section")).toHaveTextContent("Mesa 2");
    expect(screen.queryByRole("heading", { name: /^Cobradas hoy/ })).not.toBeInTheDocument();
  });

  it("el responsable deja solo las cuentas de su usuario", async () => {
    nav.query = "employee_id=7";
    vi.mocked(getDashboardStats).mockResolvedValue({ active_modules: ["employees"] } as never);
    vi.mocked(employeesService.list).mockResolvedValue({ results: [{ id: 7, user_id: 1, name: "Ana" }] } as never);
    vi.mocked(restaurantService.overview).mockResolvedValue(tables);
    renderWithProviders(<OrdenesPage />);

    const open = await screen.findByRole("heading", { name: /^Abiertas/ });
    expect(open.closest("section")).toHaveTextContent("Mesa 1");
  });
});

describe("Órdenes y Cobradas en una sola entrada (spec 051)", () => {
  const service = () => {
    vi.mocked(restaurantService.overview).mockResolvedValue({ results: [], takeouts: [], ready_items: [] });
    useAuthStore.setState({ user: { id: 1, role: "owner", companies: [{ id: 1, role: "owner", name: "Volta", order_mode: "service" }] } } as never);
  };
  const ticket = { id: 5, folio: "T-000005", status: "paid", total: "120.00", created_at: new Date().toISOString(), payment_method: "cash", work_order: { id: 3, title: "Cambio de pantalla", employee: { id: 2, name: "Luis" } }, check: null };

  it("con ambos módulos muestra Activas y Cobradas, y Activas es la de omisión", async () => {
    service();
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("button", { name: "Activas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Cobradas" })).toHaveAttribute("aria-pressed", "false");
    expect(ticketsService.list).not.toHaveBeenCalled();
  });

  it("?vista=cobradas abre Cobradas con la lista de tickets", async () => {
    service();
    nav.query = "vista=cobradas";
    vi.mocked(ticketsService.list).mockResolvedValue({ results: [ticket], info: { total: 1, page_index: 1, page_end: 1 } } as never);
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByText("T-000005")).toBeInTheDocument();
    expect(screen.getByText("Cambio de pantalla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cobradas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("cambiar de pestaña deja la URL solo con la vista y volver a Activas la limpia", async () => {
    service();
    nav.query = "vista=cobradas&status=paid&search=T-1&page=2";
    renderWithProviders(<OrdenesPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Activas" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/es/ordenes", { scroll: false });
  });

  it("sin el módulo de tickets solo hay Activas: sin pestañas, sin pie y sin solicitudes a tickets", async () => {
    service();
    plan.locked = ["tickets"];
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("heading", { name: "Órdenes de trabajo", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Vista de órdenes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver cobradas/ })).not.toBeInTheDocument();
    expect(ticketsService.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("?vista=cobradas sin el módulo de tickets cae a Activas sin avisos", async () => {
    service();
    plan.locked = ["tickets"];
    nav.query = "vista=cobradas";
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("heading", { name: "Órdenes de trabajo", level: 1 })).toBeInTheDocument();
    expect(ticketsService.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("con tickets y sin órdenes la entrada se llama Cobradas y muestra solo esa vista", async () => {
    service();
    plan.locked = ["work_orders"];
    vi.mocked(ticketsService.list).mockResolvedValue({ results: [ticket], info: { total: 1, page_index: 1, page_end: 1 } } as never);
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("heading", { name: "Cobradas", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("T-000005")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Vista de órdenes" })).not.toBeInTheDocument();
  });

  it("con restaurante, Cobradas lista tickets de cuentas de mesa y se busca por mesa", async () => {
    vi.mocked(restaurantService.overview).mockResolvedValue(tables);
    nav.query = "vista=cobradas&search=Mesa";
    const mesa = { ...ticket, id: 6, folio: "T-000006", work_order: null, check: { id: 50, table: "3", takeout_name: null, waiter: { id: 1, name: "Sara" } } };
    vi.mocked(ticketsService.list).mockResolvedValue({ results: [mesa], info: { total: 1, page_index: 1, page_end: 1 } } as never);
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("heading", { name: "Cuentas", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("T-000006")).toBeInTheDocument();
    expect(screen.getByText("Mesa 3")).toBeInTheDocument();
    expect(ticketsService.list).toHaveBeenCalledWith(expect.objectContaining({ search: "Mesa" }));
  });

  it("un super admin en la vista de su empresa ve lo mismo que el dueño", async () => {
    service();
    useAuthStore.setState({ role: "owner", companyView: true, user: { id: 1, role: "super_admin", companies: [{ id: 1, role: "owner", name: "Volta", order_mode: "service" }] } } as never);
    renderWithProviders(<OrdenesPage />);

    expect(await screen.findByRole("button", { name: "Cobradas" })).toBeInTheDocument();
  });
});
