// src/services/employees.ts
import { apiClient } from "@/lib/api";
import type { Employee, EmployeeFilters, ListParams, PaginatedResponse } from "@/types";

export type EmployeeListParams = EmployeeFilters & ListParams;

export interface EmployeePayload {
  name: string;
  position?: string;
  department?: string;
  salary?: number;
  email?: string;
  phone?: string;
  status: "active" | "inactive";
}

export interface CreateEmployeeResponse extends Employee {
  user: {
    id: number;
    email: string;
    role: string;
    active: boolean;
  };
  temp_password: string;
}

export const employeesService = {
  list: ({
    page = 1,
    page_size = 10,
    status,
    search,
  }: EmployeeListParams = {}): Promise<PaginatedResponse<Employee>> =>
    apiClient
      .get("/api/v1/employees", {
        params: { page, page_size, status, search: search?.trim() || undefined },
      })
      .then((r) => r.data),

  getById: (id: number): Promise<Employee> =>
    apiClient.get(`/api/v1/employees/${id}`).then((r) => r.data),

  create: (data: EmployeePayload): Promise<CreateEmployeeResponse> =>
    apiClient.post("/api/v1/employees", { employee: data }).then((r) => r.data),

  update: (id: number, data: EmployeePayload): Promise<Employee> =>
    apiClient.patch(`/api/v1/employees/${id}`, { employee: data }).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/employees/${id}`).then((r) => r.data),

  toggleStatus: (id: number, currentStatus: "active" | "inactive"): Promise<Employee> =>
    apiClient
      .patch(`/api/v1/employees/${id}`, {
        employee: { status: currentStatus === "active" ? "inactive" : "active" },
      })
      .then((r) => r.data),

  checkin: (id: number): Promise<void> =>
    apiClient.post(`/api/v1/employees/${id}/checkin`).then((r) => r.data),

  checkout: (id: number): Promise<void> =>
    apiClient.post(`/api/v1/employees/${id}/checkout`).then((r) => r.data),
};
