import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { INCOME, INVENTORY, SUMMARY_BASIC, urlStore } from "@/test/report-fixtures";
import { useAuthStore } from "@/store/auth";
import { reportsService } from "@/services/reports";
import { getSubscription } from "@/services/subscription";
import type { ReportSummary, SalesReport } from "@/types";
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
vi.mock("@/services/subscription", () => ({ getSubscription: vi.fn() }));
vi.mock("@/services/reports", () => ({
  reportsService: { summary: vi.fn(), income: vi.fn(), expenses: vi.fn(), payroll: vi.fn(), inventory: vi.fn(), sales: vi.fn() },
}));

const BASIC = ["employees", "attendance", "inventory", "reports"];
const BASIC_POS = [...BASIC, "pos"];
const api = vi.mocked(reportsService);
const subscription = vi.mocked(getSubscription);

const SALES: SalesReport = {
  period: { from: "2026-10-01", to: "2026-10-21" },
  total_revenue: 127.5,
  total_sales: 2,
  units: 3,
  by_product: [
    { product_id: 1, name: "Cuaderno profesional", sku: "PAP-001", units: 3, revenue: 127.5 },
    { product_id: null, name: "Producto retirado", sku: null, units: 1, revenue: 9 },
  ],
  by_cashier: [
    { user_id: 7, name: "Ana Pérez", sales: 1, revenue: 85 },
    { user_id: null, name: null, sales: 1, revenue: 42.5 },
  ],
};

const SUMMARY_POS: ReportSummary = {
  ...SUMMARY_BASIC,
  income: { total_revenue: 127.5, tickets_paid: 2 },
  sales: { total_revenue: 127.5, total_sales: 2, units: 3 },
  previous: { period: { from: "2026-09-10", to: "2026-09-30" }, sales: { total_revenue: 100, total_sales: 1, units: 1 } },
};

beforeEach(() => {
  urlStore.set("");
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21, 20, 0));
  useAuthStore.setState({ role: "owner", selectedCompanyId: 1 });
  api.summary.mockResolvedValue(SUMMARY_POS);
  api.income.mockResolvedValue({ ...INCOME, breakdown: [{ id: 1, folio: "T-0001", total: 85, paid_at: "2026-10-10T18:00:00Z", work_order: { id: null, title: "Venta de mostrador #7", employee: "Ana Pérez" } }] });
  api.inventory.mockResolvedValue(INVENTORY);
  api.sales.mockResolvedValue(SALES);
  subscription.mockResolvedValue({ active_modules: BASIC_POS } as Awaited<ReturnType<typeof getSubscription>>);
});

const tab = (name: string) => screen.getByRole("tab", { name });
const tabs = () => within(screen.getByRole("tablist", { name: "Reportes" })).getAllByRole("tab").map((b) => b.textContent);

describe("Reportes con punto de venta (spec 050)", () => {
  it("Básico con pos ve Resumen, Inventario, Ventas, Ingresos y Gastos", async () => {
    renderWithProviders(<ReportContent />);
    await screen.findByText("Ingresos cobrados");

    await waitFor(() => expect(tabs()).toEqual(expect.arrayContaining(["Resumen", "Inventario", "Ventas", "Ingresos", "Gastos"])));
  });

  it("Básico sin pos no tiene Ventas ni Ingresos", async () => {
    subscription.mockResolvedValue({ active_modules: BASIC } as Awaited<ReturnType<typeof getSubscription>>);
    api.summary.mockResolvedValue(SUMMARY_BASIC);
    renderWithProviders(<ReportContent />);
    await screen.findByText("Gastos del periodo");

    await waitFor(() => expect(tabs()).not.toContain("Ventas"));
    expect(tabs()).not.toContain("Ingresos");
  });

  it("el Resumen muestra las ventas con su comparación y no el por cobrar", async () => {
    renderWithProviders(<ReportContent />);

    expect(await screen.findByText("Ventas de mostrador")).toBeInTheDocument();
    expect(screen.getByText(/2 ventas · 3 unidades/)).toBeInTheDocument();
    expect(screen.queryByText("Por cobrar")).not.toBeInTheDocument();
    expect(screen.queryByText("Órdenes")).not.toBeInTheDocument();
  });

  it("la pestaña Ventas pide el reporte con el periodo y lista por producto y por cajero", async () => {
    renderWithProviders(<ReportContent />);
    await screen.findByText("Ingresos cobrados");

    act(() => tab("Ventas").click());

    await waitFor(() => expect(api.sales).toHaveBeenCalled());
    expect(api.sales).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-21" }, undefined);
    expect(await screen.findByText("Cuaderno profesional")).toBeInTheDocument();
    expect(screen.getByText("PAP-001")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Sin cajero")).toBeInTheDocument();
  });

  it("Ventas se exporta a CSV por tabla", async () => {
    renderWithProviders(<ReportContent />);
    await screen.findByText("Ingresos cobrados");
    act(() => tab("Ventas").click());
    await screen.findByText("Cuaderno profesional");

    expect(screen.getByRole("button", { name: /Exportar.*ventas-por-producto/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Exportar.*ventas-por-cajero/i })).toBeEnabled();
  });

  it("sin ventas en el periodo muestra el vacío con guía", async () => {
    api.sales.mockResolvedValue({ ...SALES, total_sales: 0, total_revenue: 0, units: 0, by_product: [], by_cashier: [] });
    renderWithProviders(<ReportContent />);
    await screen.findByText("Ingresos cobrados");
    act(() => tab("Ventas").click());

    await waitFor(() => expect(api.sales).toHaveBeenCalled());
    expect(await screen.findByText("No hay datos en este periodo")).toBeInTheDocument();
  });

  it("un error de ventas ofrece reintentar", async () => {
    api.sales.mockRejectedValue(new Error("falló"));
    renderWithProviders(<ReportContent />);
    await screen.findByText("Ingresos cobrados");
    act(() => tab("Ventas").click());

    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("Ingresos con solo punto de venta habla de ventas y cajeros", async () => {
    renderWithProviders(<ReportContent />);
    await screen.findByText("Ingresos cobrados");
    act(() => tab("Ingresos").click());

    expect(await screen.findByText("Venta de mostrador #7")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Venta" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Cajero" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Orden" })).not.toBeInTheDocument();
  });
});
