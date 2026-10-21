import { act, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn().mockResolvedValue({ active_modules: ["reports"] }) }));
vi.mock("@/services/reports", () => ({
  reportsService: { summary: vi.fn(), income: vi.fn(), expenses: vi.fn(), payroll: vi.fn() },
}));

const api = vi.mocked(reportsService);
let blobs: Blob[] = [];
let downloads: string[] = [];

beforeEach(() => {
  urlStore.set("rango=personalizado&desde=2026-10-01&hasta=2026-10-21");
  vi.clearAllMocks();
  useAuthStore.setState({ role: "owner", selectedCompanyId: null });
  api.summary.mockResolvedValue(SUMMARY);
  api.income.mockResolvedValue(INCOME);
  api.expenses.mockResolvedValue(EXPENSES);
  api.payroll.mockResolvedValue(PAYROLL);
  blobs = [];
  downloads = [];
  URL.createObjectURL = vi.fn((blob: Blob) => (blobs.push(blob), "blob:test"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});

async function open(tabName: string) {
  renderWithProviders(<ReportContent />);
  act(() => screen.getByRole("button", { name: tabName }).click());
}

describe("exportar a CSV", () => {
  it("Ingresos exporta sus filas con el total de la pantalla y los acentos y comillas intactos", async () => {
    await open("Ingresos");
    expect(await screen.findByText("T-0001")).toBeInTheDocument();
    const total = within(screen.getByRole("columnheader", { name: "Folio" }).closest("table")!).getAllByRole("row").at(-1)!;
    expect(total).toHaveTextContent("$351"); // 350.5 sin decimales en pantalla

    act(() => screen.getByRole("button", { name: "Exportar CSV de cobros" }).click());
    expect(downloads).toEqual(["reportes-cobros-2026-10-01_2026-10-21.csv"]);
    const text = await blobs[0].text();
    expect(text).toContain("Folio,Orden,Empleado,Total,Fecha de pago");
    expect(text).toContain('T-0001,"Pérez, ""Beto""",Ana,100,2026-10-10');
    expect(text).toContain("T-0002,Mesa 4,,250.5,2026-10-10");
    const sum = text.trim().split("\r\n").slice(1).reduce((s, line) => s + Number(line.split(",").at(-2)), 0);
    expect(sum).toBe(INCOME.total_revenue);
  });

  it("Gastos tiene un botón por tabla y cada uno descarga solo la suya", async () => {
    await open("Gastos");
    await screen.findByText("Cable");
    const payrollButton = screen.getByRole("button", { name: "Exportar CSV de nomina-activa" });
    const inventoryButton = screen.getByRole("button", { name: "Exportar CSV de inventario" });

    act(() => payrollButton.click());
    act(() => inventoryButton.click());
    expect(downloads).toEqual(["reportes-nomina-activa-2026-10-01_2026-10-21.csv", "reportes-inventario-2026-10-01_2026-10-21.csv"]);
    expect(await blobs[0].text()).toContain("Empleado,Salario mensual\r\nAna,5000");
    expect(await blobs[1].text()).toContain("2026-10-10,Cable,C-1,6,10.5,63");
  });

  it("con la tabla vacía el botón está deshabilitado", async () => {
    api.income.mockResolvedValue({ ...INCOME, breakdown: [], by_period: [], total_tickets: 0, total_revenue: 0 });
    api.expenses.mockResolvedValue({ ...EXPENSES, payroll: { ...EXPENSES.payroll, employees: [] }, inventory_cost: { ...EXPENSES.inventory_cost, movements: [], by_period: [] } });
    await open("Gastos");
    await screen.findByText("No hay datos en este periodo");
    expect(screen.queryByRole("button", { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });
});

describe("Nómina", () => {
  it("lista días y horas, sin columnas de retardos ni faltas, y su CSV tampoco las lleva", async () => {
    await open("Nómina");
    expect((await screen.findAllByText("24.5")).length).toBeGreaterThan(0);
    for (const header of ["Empleado", "Salario", "Días presentes", "Horas trabajadas"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(screen.queryByRole("columnheader", { name: /tarde|ausente|retardo|falta/i })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Total/ })).toHaveTextContent("$5,000");

    act(() => screen.getByRole("button", { name: "Exportar CSV de nomina" }).click());
    const text = await blobs[0].text();
    expect(text).toContain("Empleado,Salario,Días presentes,Horas trabajadas\r\nAna,5000,3,24.5");
  });
});

describe("gráficas accesibles", () => {
  it("cada gráfica tiene descripción y una tabla 'Ver datos' con todos sus valores", async () => {
    await open("Ingresos");
    const figure = (await screen.findAllByText("Ingresos por periodo"))[0].closest("figure")!;
    expect(within(figure).getByRole("img")).toHaveAttribute("aria-label", expect.stringContaining("10 oct"));
    const data = within(figure).getByText("Ver datos").closest("details")!;
    expect(within(data).getByRole("rowheader", { name: "10 oct" })).toBeInTheDocument();
    expect(within(data).getByRole("cell", { name: "$351" })).toBeInTheDocument();
  });

  it("Resumen: la dona de gastos trae su leyenda con valor y porcentaje, y las órdenes su tabla", async () => {
    renderWithProviders(<ReportContent />);
    await waitFor(() => expect(screen.getAllByText("Gastos: nómina e inventario").length).toBeGreaterThan(0));
    const donut = screen.getAllByText("Gastos: nómina e inventario")[0].closest("figure")!;
    expect(within(donut).getAllByText(/\$5,000/).length).toBeGreaterThan(0);
    expect(within(donut).getByText(/93%/)).toBeInTheDocument();
    const orders = screen.getAllByText("Órdenes por estado")[0].closest("figure")!;
    expect(within(orders).getByRole("rowheader", { name: "Abierta" })).toBeInTheDocument();
  });
});
