// Ayudantes comunes de las pruebas de Reportes: URL simulada, nivo sin canvas y respuestas de ejemplo.
import type { ExpensesReport, IncomeReport, PayrollReport, ReportSummary } from "@/types";

export const urlStore = (() => {
  let search = "";
  const listeners = new Set<() => void>();
  return {
    get: () => search,
    set: (next: string) => {
      search = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
})();

export const SUMMARY: ReportSummary = {
  period: { type: "custom", from: "2026-10-01", to: "2026-10-21" },
  income: { total_revenue: 10_000, tickets_paid: 5, pending_revenue: 1_500, tickets_pending: 2 },
  work_orders: { total: 8, total_billed: 9_000, by_status: { open: 2, in_progress: 1, done: 1, paid: 4, cancelled: 0 } },
  expenses: { payroll: 5_000, inventory_cost: 400, total: 5_400 },
  attendance: { total: 12, normal: 12, late: 0, absent: 0 },
  previous: {
    period: { from: "2026-09-10", to: "2026-09-30" },
    income: { total_revenue: 8_000, pending_revenue: 0 },
    expenses: { payroll: 5_000, inventory_cost: 600, total: 5_600 },
  },
};

export const INCOME: IncomeReport = {
  period: { from: "2026-10-01", to: "2026-10-21" },
  total_revenue: 350.5,
  total_tickets: 2,
  by_period: [{ period: "2026-10-10", revenue: 350.5, count: 2 }],
  breakdown: [
    { id: 1, folio: "T-0001", total: 100, paid_at: "2026-10-10T18:00:00Z", work_order: { id: 1, title: "Pérez, \"Beto\"", employee: "Ana" } },
    { id: 2, folio: "T-0002", total: 250.5, paid_at: "2026-10-10T19:00:00Z", work_order: { id: 2, title: "Mesa 4", employee: null } },
  ],
  by_method: [],
  by_terminal: [],
};

export const EXPENSES: ExpensesReport = {
  period: { from: "2026-10-01", to: "2026-10-21" },
  total_expenses: 5_063,
  payroll: { total: 5_000, headcount: 1, employees: [{ id: 1, name: "Ana", position: null, department: null, salary: 5_000 }] },
  inventory_cost: {
    total: 63,
    by_period: [{ period: "2026-10-10", cost: 63, count: 1 }],
    movements: [{ id: 1, created_at: "2026-10-10T18:00:00Z", product_name: "Cable", sku: "C-1", qty: 6, unit_cost: 10.5, cost: 63, note: null }],
  },
};

export const PAYROLL: PayrollReport = {
  period: { from: "2026-10-01", to: "2026-10-21" },
  total_payroll: 5_000,
  headcount: 1,
  employees: [
    { id: 1, name: "Ana", position: null, department: null, salary: 5_000, days_present: 3, hours_worked: 24.5, attendance: { normal: 3, late: 2, absent: 1 } },
  ],
};
