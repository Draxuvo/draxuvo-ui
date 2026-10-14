// src/services/branches.ts
// Contrato: specs/004-refactor-web-panel/contracts/api.md ("/company/branches"). Solo owner.
import { apiClient } from "@/lib/api";
import type { Branch, User } from "@/types";

export interface CreateBranchResponse {
  company: Branch;
  user: User;
}

export const branchesService = {
  /** La empresa principal y sus sucursales; también responde desde una sucursal. */
  list: (): Promise<Branch[]> =>
    apiClient.get("/api/v1/company/branches").then((r) => r.data),

  // La pantalla muestra `company_limit_reached` y `module_not_in_plan` por su cuenta.
  create: (name: string): Promise<CreateBranchResponse> =>
    apiClient
      .post("/api/v1/company/branches", { branch: { name } }, { skipErrorToast: true })
      .then((r) => r.data),
};
