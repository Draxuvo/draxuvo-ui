// src/services/companies.ts
import { apiClient } from "@/lib/api";
import type { Company, PaginatedResponse } from "@/types";

export interface CompanyPayload {
  name: string;
  active?: boolean;
}

export const companiesService = {
  list: (page = 1, search = "", pageSize = 10): Promise<PaginatedResponse<Company>> =>
    apiClient
      .get("/api/v1/companies", {
        params: { page, page_size: pageSize, search: search || undefined },
      })
      .then((r) => r.data),

  getById: (id: number): Promise<Company> =>
    apiClient.get(`/api/v1/companies/${id}`).then((r) => r.data),

  create: (data: CompanyPayload): Promise<Company> =>
    apiClient.post("/api/v1/companies", { company: data }).then((r) => r.data),

  update: (id: number, data: CompanyPayload): Promise<Company> =>
    apiClient.patch(`/api/v1/companies/${id}`, { company: data }).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/companies/${id}`).then((r) => r.data),
};
