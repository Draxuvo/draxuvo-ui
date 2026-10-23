// src/services/payroll.ts
import { apiClient } from "@/lib/api";
import type {
  PaginatedResponse,
  PayrollAdjustment,
  PayrollMethod,
  PayrollPayment,
  PayrollPeriodType,
  PayrollRun,
  PayrollRunStatus,
} from "@/types";

const base = "/api/v1";

export interface PayrollRunListParams {
  page?: number;
  page_size?: number;
  status?: PayrollRunStatus;
  year?: number;
}

export interface NewRunPayload {
  period_type: PayrollPeriodType;
  starts_on: string;
  ends_on: string;
}

export interface PayPayload {
  method: PayrollMethod;
  paid_on: string;
  reference?: string;
}

export interface AdjustmentPayload {
  kind: "bonus" | "deduction";
  amount_cents: number;
  note: string;
  corrects_payment_id?: number;
}

const keyed = (idempotencyKey: string) => ({ headers: { "Idempotency-Key": idempotencyKey } });

export const payrollService = {
  list: ({ page = 1, page_size = 10, status, year }: PayrollRunListParams = {}): Promise<PaginatedResponse<PayrollRun>> =>
    apiClient.get(`${base}/payroll_runs`, { params: { page, page_size, status, year } }).then((r) => r.data),

  get: (id: number): Promise<PayrollRun> => apiClient.get(`${base}/payroll_runs/${id}`).then((r) => r.data),

  create: (data: NewRunPayload): Promise<PayrollRun> => apiClient.post(`${base}/payroll_runs`, data).then((r) => r.data),

  discard: (id: number): Promise<void> => apiClient.delete(`${base}/payroll_runs/${id}`).then(() => undefined),

  refreshEmployees: (id: number): Promise<PayrollRun> =>
    apiClient.post(`${base}/payroll_runs/${id}/refresh_employees`).then((r) => r.data),

  approve: (id: number, lockVersion: number, idempotencyKey: string): Promise<PayrollRun> =>
    apiClient.post(`${base}/payroll_runs/${id}/approve`, { lock_version: lockVersion }, keyed(idempotencyKey)).then((r) => r.data),

  cancel: (id: number, reason: string): Promise<PayrollRun> =>
    apiClient.post(`${base}/payroll_runs/${id}/cancel`, { reason }).then((r) => r.data),

  payAll: (id: number, data: PayPayload, paymentIds: number[] | undefined, idempotencyKey: string): Promise<PayrollRun> =>
    apiClient
      .post(`${base}/payroll_runs/${id}/pay_all`, { ...data, payment_ids: paymentIds }, keyed(idempotencyKey))
      .then((r) => r.data),

  exportCsv: (id: number): Promise<Blob> =>
    apiClient.get(`${base}/payroll_runs/${id}/export`, { responseType: "blob" }).then((r) => r.data),

  setDaysPaid: (paymentId: number, daysPaid: number, lockVersion: number): Promise<PayrollPayment> =>
    apiClient.patch(`${base}/payroll_payments/${paymentId}`, { days_paid: daysPaid, lock_version: lockVersion }).then((r) => r.data),

  removeLine: (paymentId: number): Promise<void> =>
    apiClient.delete(`${base}/payroll_payments/${paymentId}`).then(() => undefined),

  pay: (paymentId: number, data: PayPayload, idempotencyKey: string): Promise<PayrollPayment> =>
    apiClient.post(`${base}/payroll_payments/${paymentId}/pay`, data, keyed(idempotencyKey)).then((r) => r.data),

  receipt: (paymentId: number): Promise<PayrollPayment> =>
    apiClient.get(`${base}/payroll_payments/${paymentId}`).then((r) => r.data),

  addAdjustment: (paymentId: number, data: AdjustmentPayload): Promise<PayrollAdjustment> =>
    apiClient.post(`${base}/payroll_payments/${paymentId}/adjustments`, data).then((r) => r.data),

  updateAdjustment: (id: number, data: Pick<AdjustmentPayload, "kind" | "amount_cents" | "note">): Promise<PayrollAdjustment> =>
    apiClient.patch(`${base}/payroll_adjustments/${id}`, data).then((r) => r.data),

  removeAdjustment: (id: number): Promise<void> =>
    apiClient.delete(`${base}/payroll_adjustments/${id}`).then(() => undefined),

  employeeHistory: (employeeId: number, page = 1): Promise<PaginatedResponse<PayrollPayment>> =>
    apiClient.get(`${base}/employees/${employeeId}/payroll_payments`, { params: { page, page_size: 20 } }).then((r) => r.data),
};
