import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { EXPENSES, INCOME, PAYROLL, SUMMARY, urlStore } from "@/test/report-fixtures";
import { useAuthStore } from "@/store/auth";
import { reportsService } from "@/services/reports";
import { ReportContent } from "./report-content";

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await vi.importActual<typeof import("react")>("react");
  return {
    useRouter: () => ({ replace: (url: string) => urlStore.set(url.split("?")[1] ?? "") }),
    usePathname: () => "/es/reportes",
    useSearchParams: () => {
      useSyncExternalStore(urlStore.subscribe, urlStore.get, urlStore.get);
      return new URLSearchParams(urlStore.get());
    },
  };
});
vi.mock("@nivo/bar", () => ({ ResponsiveBar: () => <div data-testid="bars" /> }));
vi.mock("@nivo/pie", () => ({ ResponsivePie: () => <div data-testid="donut" /> }));
vi.mock("@/services/subscription", () => ({
  getSubscription: vi.fn().mockResolvedValue({ active_modules: ["reports", "work_orders"] }),
}));
vi.mock("@/services/reports", () => ({
  reportsService: { summary: vi.fn(), income: vi.fn(), expenses: vi.fn(), payroll: vi.fn() },
}));

const api = vi.mocked(reportsService);

beforeEach(() => {
  urlStore.set("");
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21, 20, 0));
  useAuthStore.setState({ role: "owner", selectedCompanyId: null });
  api.summary.mockResolvedValue(SUMMARY);
  api.income.mockResolvedValue(INCOME);
  api.expenses.mockResolvedValue(EXPENSES);
  api.payroll.mockResolvedValue(PAYROLL);
});

const tab = (name: string) => screen.getByRole("button", { name });

describe("ReportContent", () => {
  it("el periodo elegido se conserva al cambiar de pestaña y llega a cada consulta", async () => {
    renderWithProviders(<ReportContent />);
    await screen.findByText("Ingresos cobrados");

    act(() => screen.getByRole("button", { name: "Mes pasado" }).click());
    const range = { from: "2026-09-01", to: "2026-09-30" };
    await waitFor(() => expect(api.summary).toHaveBeenCalledWith(range, false, undefined));

    for (const [name, call] of [
      ["Ingresos", () => api.income] as const,
      ["Gastos", () => api.expenses] as const,
    ]) {
      act(() => tab(name).click());
      await waitFor(() => expect(call()).toHaveBeenCalledWith(range, "day", undefined));
    }
    act(() => tab("Nómina").click());
    await waitFor(() => expect(api.payroll).toHaveBeenCalledWith(range, undefined));
    expect(screen.getByRole("button", { name: "Mes pasado" })).toHaveAttribute("aria-pressed", "true");
  });

  it("pasa la empresa elegida (super admin) a la consulta", async () => {
    renderWithProviders(<ReportContent companyId={7} />);
    await waitFor(() => expect(api.summary).toHaveBeenCalledWith(expect.anything(), false, 7));
  });

  it("el botón de actualizar tiene nombre accesible", async () => {
    renderWithProviders(<ReportContent />);
    expect(screen.getByRole("button", { name: "Actualizar reporte" })).toBeInTheDocument();
    await screen.findByText("Ingresos cobrados");
  });
});

describe("Resumen", () => {
  it("tiene una cifra principal y las demás subordinadas, sin retardos ni faltas", async () => {
    renderWithProviders(<ReportContent />);
    expect(await screen.findByText("$10,000")).toBeInTheDocument();
    expect(screen.getByText("Ingresos cobrados")).toBeInTheDocument();
    expect(screen.getAllByText("Gastos").length).toBeGreaterThan(1); // pestaña y cifra
    for (const label of ["Por cobrar", "Órdenes", "Asistencias registradas"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/tarde|ausente|retardo|falta/i)).not.toBeInTheDocument();
    // La cifra de cobrado aparece una sola vez: no se repite en una lista junto a la gráfica.
    expect(screen.getAllByText("$10,000")).toHaveLength(1);
  });

  it("sin comparar no hay variación; al comparar muestra ingresos y gastos contra el periodo anterior", async () => {
    renderWithProviders(<ReportContent />);
    await screen.findByText("$10,000");
    expect(screen.queryByText(/vs\. periodo anterior/)).not.toBeInTheDocument();

    act(() => screen.getByRole("switch", { name: "Comparar con el periodo anterior" }).click());
    await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith(expect.anything(), true, undefined));
    expect(await screen.findByText(/Subió 25 %/)).toBeInTheDocument();
    expect(screen.getByText(/Bajó 3\.6 %/)).toBeInTheDocument();
  });

  it("con el periodo anterior vacío dice que no hay base comparable", async () => {
    api.summary.mockResolvedValue({
      ...SUMMARY,
      previous: { ...SUMMARY.previous!, income: { total_revenue: 0, pending_revenue: 0 }, expenses: { payroll: 0, inventory_cost: 0, total: 0 } },
    });
    urlStore.set("comparar=1");
    renderWithProviders(<ReportContent />);
    expect(await screen.findAllByText("Sin periodo anterior comparable")).toHaveLength(2);
  });

  it("cada cifra explica de dónde sale y 'Por cobrar' no lleva variación", async () => {
    urlStore.set("comparar=1");
    renderWithProviders(<ReportContent />);
    expect(await screen.findByText("5 tickets cobrados en el periodo")).toBeInTheDocument();
    expect(screen.getByText("2 tickets creados en el periodo y sin cobrar")).toBeInTheDocument();
    expect(screen.getByText("Nómina activa más entradas de inventario")).toBeInTheDocument();
    // La variación solo acompaña a ingresos cobrados y gastos.
    expect(screen.getAllByText(/vs\. periodo anterior/)).toHaveLength(2);
  });

  it("oculta los bloques de módulos fuera del plan en vez de mostrarlos en cero", async () => {
    useAuthStore.setState({ role: "owner", selectedCompanyId: 1 });
    renderWithProviders(<ReportContent />);
    await screen.findByText("$10,000");
    await waitFor(() => expect(screen.queryByText("Asistencias registradas")).not.toBeInTheDocument());
    expect(screen.getByText("Órdenes")).toBeInTheDocument();
  });
});

describe("estados", () => {
  it("un fallo muestra el error con Reintentar, no ceros, y reintentar recupera", async () => {
    api.summary.mockRejectedValueOnce(new Error("boom"));
    renderWithProviders(<ReportContent />);
    expect(await screen.findByText("No se pudo cargar el reporte")).toBeInTheDocument();
    expect(screen.queryByText("$0")).not.toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "Reintentar" }).click());
    expect(await screen.findByText("$10,000")).toBeInTheDocument();
  });

  it("un periodo sin datos dice qué hacer y ofrece ampliar", async () => {
    api.income.mockResolvedValue({ ...INCOME, breakdown: [], by_period: [], total_tickets: 0, total_revenue: 0 });
    urlStore.set("rango=hoy");
    renderWithProviders(<ReportContent />);
    act(() => tab("Ingresos").click());
    expect(await screen.findByText("No hay datos en este periodo")).toBeInTheDocument();
    expect(screen.getByText("Prueba con un rango más amplio.")).toBeInTheDocument();

    act(() => screen.getByRole("button", { name: "Ver este mes" }).click());
    expect(urlStore.get()).toBe("");
  });

  it("un error al refrescar conserva los datos ya mostrados con un aviso", async () => {
    renderWithProviders(<ReportContent />);
    await screen.findByText("$10,000");
    api.summary.mockRejectedValueOnce(new Error("boom"));
    act(() => screen.getByRole("button", { name: "Actualizar reporte" }).click());
    expect(await screen.findByText("No se pudo actualizar. Se muestran los últimos datos cargados.")).toBeInTheDocument();
    expect(screen.getByText("$10,000")).toBeInTheDocument();
  });
});
