import { expect, test, type Page } from "@playwright/test";
import { createCompany, E2E_PASSWORD } from "../support/data";
import { t } from "../support/i18n";
import { API_URL, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "../support/session";

const ANON = { cookies: [], origins: [] };
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });
const row = (page: Page, text: string) => page.getByRole("listitem").filter({ hasText: text });

async function apiLogin(request: import("@playwright/test").APIRequestContext, email: string, password: string) {
  const res = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { token: body.token as string, user: body.user as { id: number; companies?: { id: number }[] } };
}

// Spec 028: el super admin con membresía de administrador entra al panel de su empresa, ve Personal
// con el rol de la membresía, conserva sus poderes (edita al dueño) y vuelve a su panel global.
test("[PER-001] el super admin con membresía entra a Mi empresa, gestiona el acceso y vuelve al panel global @regresion", async ({
  browser,
  request,
}, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const owner = await apiLogin(request, company.email, E2E_PASSWORD);
  const companyId = owner.user.companies?.[0]?.id;
  expect(companyId).toBeTruthy();
  const superAdmin = await apiLogin(request, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
  const headers = { Authorization: `Bearer ${superAdmin.token}`, "X-Company-Id": String(companyId) };

  // La empresa nueva lo suma como administrador.
  const invited = await request.post(`${API_URL}/api/v1/company/members`, {
    headers,
    data: { member: { email: SUPER_ADMIN_EMAIL, role: "admin" } },
  });
  expect(invited.ok()).toBeTruthy();

  const context = await browser.newContext({ storageState: ANON });
  try {
    const page = await context.newPage();
    await page.goto("/es/login");
    await page.getByLabel(t("auth.email"), { exact: true }).fill(SUPER_ADMIN_EMAIL);
    await page.getByLabel(t("auth.password"), { exact: true }).fill(SUPER_ADMIN_PASSWORD);
    await page.getByRole("button", { name: t("auth.submit") }).click();
    await expect(page).toHaveURL(/\/es\/empresas$/);

    // Entra a su empresa: menú de administrador, con Personal.
    await menu(page).getByRole("link", { name: t("nav.myCompany") }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);
    expect((await context.cookies()).find((c) => c.name === "user_role")?.value).toBe("admin");
    await menu(page).getByRole("link", { name: t("nav.people") }).click();
    await page.getByRole("tab", { name: t("people.tabs.access") }).click();
    await expect(page).toHaveURL(/\/es\/personal\?tab=acceso$/);

    // Conserva sus poderes: a diferencia de un administrador, puede cambiar el rol del dueño.
    await expect(row(page, company.email).getByRole("combobox")).toHaveCount(1);

    // Vuelve a su panel global.
    await menu(page).getByRole("link", { name: t("nav.backToGlobal") }).click();
    await expect(page).toHaveURL(/\/es\/empresas$/);
    expect((await context.cookies()).find((c) => c.name === "user_role")?.value).toBe("super_admin");
  } finally {
    await context.close();
    // No dejar la membresía: otras pruebas del super admin esperan su menú global sin "Mi empresa".
    await request.delete(`${API_URL}/api/v1/company/members/${superAdmin.user.id}`, { headers });
  }
});
