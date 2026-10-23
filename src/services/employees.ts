// src/services/employees.ts
import { apiClient } from "@/lib/api";
import type { CompanyRole, Employee, EmployeeFilters, ListParams, PaginatedResponse } from "@/types";

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

/** Rol con el que se da acceso al alta (spec 036); se ignora si no hay correo. */
export interface EmployeeAccessPayload {
  role: CompanyRole;
}

export const employeesService = {
  list: ({
    page = 1,
    page_size = 10,
    status,
    search,
    access,
  }: EmployeeListParams = {}): Promise<PaginatedResponse<Employee>> =>
    apiClient
      .get("/api/v1/employees", {
        params: { page, page_size, status, access, search: search?.trim() || undefined },
      })
      .then((r) => r.data),

  getById: (id: number): Promise<Employee> =>
    apiClient.get(`/api/v1/employees/${id}`).then((r) => r.data),

  create: (data: EmployeePayload, access?: EmployeeAccessPayload): Promise<Employee> =>
    apiClient.post("/api/v1/employees", { employee: data, access }).then((r) => r.data),

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

  // Acceso al panel desde la ficha (spec 036).
  grantAccess: (id: number, data: { email: string; phone?: string; role: CompanyRole }): Promise<Employee> =>
    apiClient.post(`/api/v1/employees/${id}/access`, data).then((r) => r.data),
  changeAccess: (id: number, role: CompanyRole): Promise<Employee> =>
    apiClient.patch(`/api/v1/employees/${id}/access`, { role }).then((r) => r.data),
  revokeAccess: (id: number): Promise<Employee> =>
    apiClient.delete(`/api/v1/employees/${id}/access`).then((r) => r.data),
};
