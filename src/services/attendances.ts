// src/services/attendances.ts
import { apiClient } from "@/lib/api";
import type { Attendance, AttendanceFilters, ListParams, PaginatedResponse } from "@/types";

export type AttendanceListParams = AttendanceFilters & ListParams;

export const attendancesService = {
  list: ({
    page = 1,
    page_size = 20,
    from,
    to,
    employee_id,
    type,
  }: AttendanceListParams = {}): Promise<PaginatedResponse<Attendance>> =>
    apiClient
      .get("/api/v1/attendances", {
        params: { page, page_size, from, to, employee_id, type },
      })
      .then((r) => r.data),
};
