import { apiClient } from "@/lib/api";
import type { ReportSummary, IncomeReport, ExpensesReport, PayrollReport } from "@/types";

export type GroupBy = "day" | "week" | "month" | "year";

export interface DateRange {
  from: string;
  to: string;
}

function companyHeaders(companyId?: number) {
  return companyId ? { headers: { "X-Company-Id": String(companyId) } } : {};
}

export const reportsService = {
  summary: (range: DateRange, compare: boolean, companyId?: number): Promise<ReportSummary> =>
    apiClient
      .get("/api/v1/reports/summary", {
        params: { ...range, ...(compare ? { compare: "true" } : {}) },
        ...companyHeaders(companyId),
      })
      .then((r) => r.data),

  income: (range: DateRange, group_by: GroupBy, companyId?: number): Promise<IncomeReport> =>
    apiClient
      .get("/api/v1/reports/income", { params: { ...range, group_by }, ...companyHeaders(companyId) })
      .then((r) => r.data),

  expenses: (range: DateRange, group_by: GroupBy, companyId?: number): Promise<ExpensesReport> =>
    apiClient
      .get("/api/v1/reports/expenses", { params: { ...range, group_by }, ...companyHeaders(companyId) })
      .then((r) => r.data),

  payroll: (range: DateRange, companyId?: number): Promise<PayrollReport> =>
    apiClient.get("/api/v1/reports/payroll", { params: range, ...companyHeaders(companyId) }).then((r) => r.data),
};
