// src/services/company-members.ts
// Contrato: specs/004-refactor-web-panel/contracts/api.md ("/company/members"). Empresa activa.
import { apiClient } from "@/lib/api";
import type { CompanyMember, CompanyRole, PaginatedResponse } from "@/types";

export interface InviteMemberPayload {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: CompanyRole;
}

// La pantalla convierte `error.details.code` en un mensaje propio: sin toast global.
const quiet = { skipErrorToast: true } as const;

export const companyMembersService = {
  list: (page = 1, page_size = 20): Promise<PaginatedResponse<CompanyMember>> =>
    apiClient
      .get("/api/v1/company/members", { params: { page, page_size } })
      .then((r) => r.data),

  invite: (member: InviteMemberPayload): Promise<CompanyMember> =>
    apiClient.post("/api/v1/company/members", { member }, quiet).then((r) => r.data),

  updateRole: (userId: number, role: CompanyRole): Promise<CompanyMember> =>
    apiClient
      .patch(`/api/v1/company/members/${userId}`, { member: { role } }, quiet)
      .then((r) => r.data),

  remove: (userId: number): Promise<void> =>
    apiClient.delete(`/api/v1/company/members/${userId}`, quiet).then(() => undefined),
};
