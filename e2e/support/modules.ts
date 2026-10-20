import { expect, type APIRequestContext } from "@playwright/test";
import { API_URL, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "./session";

/**
 * Apaga o enciende módulos de una empresa por API como super admin (spec 017): desde esta spec solo él puede.
 * `disabled` es la lista completa de módulos desactivados; `[]` activa todos los del plan.
 */
export async function setDisabledModules(request: APIRequestContext, companyId: string | number, disabled: string[]) {
  const login = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD } });
  expect(login.ok()).toBe(true);
  const { token } = await login.json();
  const res = await request.patch(`${API_URL}/api/v1/company/modules`, {
    headers: { Authorization: `Bearer ${token}`, "X-Company-Id": String(companyId) },
    data: { disabled_modules: disabled },
  });
  expect(res.ok()).toBe(true);
}
