import { expect, test, type Page } from "@playwright/test";
import { searchCompanies } from "../support/companies";
import { createCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL, authFile } from "../support/session";

// Módulo extra solo desde el super admin (spec 053): lo enciende él desde la hoja «Módulos» y el cliente lo ve en solo
// lectura, sin «Módulos extra» ni botones para contratarlo.
const co = (key: string, values?: Record<string, string | number>) => t(`companies.${key}`, values);
const ANON = { cookies: [], origins: [] };
const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });

async function newCompany(request: Parameters<typeof createCompany>[0], workerIndex: number) {
  const company = await createCompany(request, { workerIndex, plan: "basic" });
  const login = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: company.email, password: company.password } });
  const body = await login.json();
  return { ...company, id: body.user.companies[0].id as number, token: body.token as string };
}

test.describe("el super admin enciende el extra desde la hoja «Módulos»", () => {
  test.use({ storageState: authFile("super_admin-draxuvo") });

  test("[EXT-001] enciende el extra con confirmación de precio, queda en el historial y el dueño lo ve sin poder cambiarlo @pr", async ({ page, request, browser }, info) => {
    const company = await newCompany(request, info.workerIndex);
    await page.goto("/es/empresas");
    await searchCompanies(page, company.companyName);
    await row(page, company.companyName).getByRole("button", { name: co("modules.open", { name: company.companyName }) }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(co("modules.addon.title"))).toBeVisible();
    await sheet.getByRole("switch", { name: t("modules.pos") }).click();
    await expect(page.getByText(co("modules.addon.confirm.on.title", { name: t("modules.pos") }))).toBeVisible();
    await page.getByRole("button", { name: co("modules.addon.confirmButton") }).click();
    await expect(page.getByText(co("modules.addon.saved"))).toBeVisible();
    await expect(sheet.getByText(co("modules.addon.trial"))).toBeVisible();

    // El dueño ve el módulo en Suscripción en solo lectura y Punto de venta en su menú; no puede apagarlo por la API.
    const context = await browser.newContext({ storageState: ANON });
    const owner = await context.newPage();
    await owner.goto("/es/login");
    await owner.getByLabel(t("auth.email"), { exact: true }).fill(company.email);
    await owner.getByLabel(t("auth.password"), { exact: true }).fill(company.password);
    await owner.getByRole("button", { name: t("auth.submit") }).click();
    await expect(owner).toHaveURL(/\/es\/inicio$/);
    await expect(owner.getByRole("navigation").getByRole("link", { name: t("nav.pos"), exact: true })).toBeVisible();

    await owner.goto("/es/suscripcion");
    await expect(owner.getByRole("heading", { name: t("subscription.addons.title") })).toBeVisible();
    await expect(owner.getByText(t("modules.pos")).first()).toBeVisible();
    await expect(owner.getByText(/Módulos extra/i)).toHaveCount(0);
    await expect(owner.getByRole("button", { name: /contratar|dar de baja|reactivar/i })).toHaveCount(0);

    const off = await request.delete(`${API_URL}/api/v1/subscription/addons/pos`, {
      headers: { Authorization: `Bearer ${company.token}`, "X-Company-Id": String(company.id) },
    });
    expect(off.status()).toBe(403);
    await context.close();
  });

  test("[EXT-002] apagarlo en la prueba lo quita al instante del menú del dueño @regresion", async ({ request }, info) => {
    const company = await newCompany(request, info.workerIndex);
    const sa = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: "draxuvo@mailinator.com", password: process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin12345*" } });
    const superHeaders = { Authorization: `Bearer ${(await sa.json()).token}`, "X-Company-Id": String(company.id) };
    const on = await request.post(`${API_URL}/api/v1/subscription/addons`, { headers: superHeaders, data: { module: "pos" } });
    expect(on.status()).toBe(201);
    const off = await request.delete(`${API_URL}/api/v1/subscription/addons/pos`, { headers: superHeaders });
    expect(off.status()).toBe(200);
    const sub = await (await request.get(`${API_URL}/api/v1/subscription`, { headers: { Authorization: `Bearer ${company.token}`, "X-Company-Id": String(company.id) } })).json();
    expect(sub.active_modules).not.toContain("pos");
    expect(sub.addons).toEqual([]);
  });
});
