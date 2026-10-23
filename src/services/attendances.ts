// src/services/attendances.ts
import { apiClient } from "@/lib/api";
import type { Attendance, AttendanceFilters, ListParams, MyAttendance, PaginatedResponse, RosterRow } from "@/types";

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

  // Marca propia de entrada y salida (spec 026).
  today: (): Promise<MyAttendance> => apiClient.get("/api/v1/my_attendance/today").then((r) => r.data),
  checkIn: (): Promise<MyAttendance> => apiClient.post("/api/v1/my_attendance/check_in").then((r) => r.data),
  checkOut: (): Promise<MyAttendance> => apiClient.post("/api/v1/my_attendance/check_out").then((r) => r.data),

  // Lista del día por empleado y marca de otro empleado, con hora opcional (spec 036).
  roster: (date?: string): Promise<{ date: string; results: RosterRow[] }> =>
    apiClient.get("/api/v1/attendances/roster", { params: { date } }).then((r) => r.data),
  markCheckIn: (employeeId: number, at?: string): Promise<Attendance> =>
    apiClient.post(`/api/v1/employees/${employeeId}/checkin`, { at }).then((r) => r.data),
  markCheckOut: (employeeId: number, at?: string): Promise<Attendance> =>
    apiClient.post(`/api/v1/employees/${employeeId}/checkout`, { at }).then((r) => r.data),
};
