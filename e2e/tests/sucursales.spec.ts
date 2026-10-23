import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCompany, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL, storageStatePath } from "../support/session";

const ANON = { cookies: [], origins: [] };
const SAZON = "Restaurante Sazón";
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });
const mine = (key: string, values?: Record<string, string | number>) => t(`myCompanies.${key}`, values);
const switcher = (page: Page) => page.getByRole("button", { name: /Cambiar de empresa/ });
/** Fila de la lista de empresas (no las notificaciones, que también son <li>). */
const entry = (page: Page, name: string) =>
  page.locator("section").first().getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });

async function login(page: Page, email: string, password: string) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
}

/** Dueño de una empresa nueva con plan Empresa (incluye Multiempresa), con las cabeceras de su empresa principal. */
async function enterpriseOwner(browser: Browser, request: Parameters<typeof createCompany>[0], workerIndex: number) {
  const company: NewCompany = await createCompany(request, { workerIndex, plan: "enterprise" });
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await login(page, company.email, company.password);
  await expect(page).toHaveURL(/\/es\/inicio$/);
  const mainId = await page.evaluate(() => localStorage.getItem("selected_company_id") ?? "");
  return { context, page, company, headers: { Authorization: `Bearer ${company.token}`, "X-Company-Id": mainId } };
}

async function addBranch(page: Page, name: string) {
  await page.getByPlaceholder(mine("namePlaceholder")).fill(name);
  await page.getByRole("button", { name: mine("create"), exact: true }).click();
  await expect(page.getByText(mine("created", { company: name }))).toBeVisible();
}

test.describe("dueño de Sazón (plan Empresa, con una sucursal)", () => {
  test.use({ storageState: storageStatePath("owner", "sazon.demo") });

  test("[SUC-011] Mis empresas muestra el conteo y las etiquetas, valida el nombre y deja entrar a la sucursal @regresion", async ({ page }) => {
    await page.goto("/es/inicio");
    await menu(page).getByRole("link", { name: t("nav.myCompanies") }).click();
    await expect(page).toHaveURL(/\/es\/mis-empresas$/);
    await expect(page.getByRole("heading", { name: mine("title"), level: 1 })).toBeVisible();
    await expect(page.getByText(mine("usage", { count: 2, max: 3 }))).toBeVisible();

    await expect(entry(page, SAZON)).toContainText(mine("main"));
    await expect(entry(page, SAZON)).toContainText(mine("current"));
    await expect(entry(page, `${SAZON} Centro`)).toContainText(mine("branch"));

    // Con el nombre vacío no se llama a la API.
    await page.getByRole("button", { name: mine("create"), exact: true }).click();
    await expect(page.getByText(mine("nameRequired"))).toBeVisible();

    await page.getByRole("button", { name: /Entrar a .*Centro/ }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);
    await expect(switcher(page)).toContainText("Centro");
  });

  test("[SUC-012] desde una sucursal, Mis empresas y la suscripción mandan a la principal @regresion", async ({ page }) => {
    await page.goto("/es/inicio");
    await switcher(page).click();
    await page.getByRole("menuitemradio", { name: /Centro/ }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);

    await page.goto("/es/mis-empresas");
    await expect(page.getByText(mine("fromBranch"))).toBeVisible();
    await expect(page.getByRole("button", { name: mine("goToMain", { company: SAZON }) })).toBeVisible();
    await expect(page.getByPlaceholder(mine("namePlaceholder"))).toHaveCount(0);

    await page.goto("/es/suscripcion");
    await expect(page.getByText(t("subscription.managedByParentTitle", { company: SAZON }))).toBeVisible();
    await expect(page.getByRole("button", { name: t("subscription.managedByParentAction", { company: SAZON }) })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pagar plan/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: t("subscription.manage"), exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: t("subscription.managedByParentAction", { company: SAZON }) }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);
    await expect(switcher(page)).toContainText(SAZON);
  });
});

test.describe("quien llega a Mis empresas sin ser dueño de un plan Empresa", () => {
  test.describe("dueño de Volta (plan Pro)", () => {
    test.use({ storageState: storageStatePath("owner", "volta.demo") });

    test("[SUC-012] el menú no la incluye y por URL ofrece el plan Empresa @regresion", async ({ page }) => {
      await page.goto("/es/inicio");
      await expect(menu(page).getByRole("link", { name: t("nav.people") })).toBeVisible();
      await expect(menu(page).getByRole("link", { name: t("nav.myCompanies") })).toHaveCount(0);
      await page.goto("/es/mis-empresas");
      await expect(page.getByText(mine("upgradeTitle"))).toBeVisible();
      await expect(page.getByRole("link", { name: mine("upgradeAction") })).toBeVisible();
    });
  });

  test.describe("admin de Sazón", () => {
    test.use({ storageState: storageStatePath("admin", "sazon.demo") });

    test("[SUC-012] el admin vuelve al inicio @regresion", async ({ page }) => {
      await page.goto("/es/mis-empresas").catch(() => {});
      await expect(page).toHaveURL(/\/es\/inicio$/);
    });
  });

  test.describe("staff de Sazón", () => {
    test.use({ storageState: storageStatePath("staff", "sazon.demo") });

    test("[SUC-012] el staff va a /mis-ordenes @regresion", async ({ page }) => {
      await page.goto("/es/mis-empresas").catch(() => {});
      await expect(page).toHaveURL(/\/es\/mis-ordenes$/);
    });
  });
});

test("[SUC-011] el dueño agrega sucursales hasta el máximo y entra a la nueva @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const owner = await enterpriseOwner(browser, request, info.workerIndex);
  const { page } = owner;
  const prefix = uniquePrefix(info.workerIndex);

  await page.goto("/es/mis-empresas");
  await expect(page.getByText(mine("usage", { count: 1, max: 3 }))).toBeVisible();
  await addBranch(page, `Norte ${prefix}`);
  await expect(page.getByText(mine("usage", { count: 2, max: 3 }))).toBeVisible();
  await addBranch(page, `Sur ${prefix}`);
  await expect(page.getByText(mine("usage", { count: 3, max: 3 }))).toBeVisible();

  // Con el máximo alcanzado ya no se puede agregar otra.
  await expect(page.getByText(mine("limitReached", { max: 3 }))).toBeVisible();
  await expect(page.getByPlaceholder(mine("namePlaceholder"))).toHaveCount(0);

  await page.getByRole("button", { name: mine("switchLabel", { company: `Norte ${prefix}` }) }).click();
  await expect(page).toHaveURL(/\/es\/inicio$/);
  await expect(switcher(page)).toContainText(`Norte ${prefix}`);
  await owner.context.close();
});

test("[FLU-08] el dueño crea una sucursal, cambia de empresa y los datos no se mezclan @regresion", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const owner = await enterpriseOwner(browser, request, info.workerIndex);
  const { page, headers } = owner;
  const prefix = uniquePrefix(info.workerIndex);
  const branchName = `Centro ${prefix}`;

  // La principal trabaja en modo pedido y tiene un empleado propio.
  const mode = await request.patch(`${API_URL}/api/v1/company/order_mode`, { headers, data: { order_mode: "order" } });
  expect(mode.ok()).toBe(true);
  const employeeName = `Empleado ${prefix}`;
  const created = await request.post(`${API_URL}/api/v1/employees`, { headers, data: { employee: { name: employeeName } } });
  expect(created.status()).toBe(201);

  // 1. Crea la sucursal desde /mis-empresas.
  await page.goto("/es/mis-empresas");
  await addBranch(page, branchName);
  await expect(entry(page, branchName)).toContainText(mine("branch"));

  // 2. Cambia a la sucursal con el selector del encabezado (EMP-023).
  await switcher(page).click();
  await page.getByRole("menuitemradio", { name: new RegExp(branchName) }).click();
  await expect(page.getByText(t("companySwitcher.switched", { company: branchName }))).toBeVisible();
  await expect(page).toHaveURL(/\/es\/inicio$/);

  // 3. Hereda el modo de órdenes y la suscripción de la principal, pero no sus datos.
  await page.goto("/es/ordenes");
  await expect(page.getByRole("button", { name: t("workOrders.labels.order.new") })).toBeVisible();
  await page.goto("/es/empleados");
  await expect(page.getByText(t("employees.empty"))).toBeVisible();
  await expect(page.getByText(employeeName)).toHaveCount(0);
  await page.goto("/es/suscripcion");
  await expect(page.getByText(t("subscription.managedByParentTitle", { company: owner.company.companyName }))).toBeVisible();

  // 4. De vuelta en la principal, su empleado sigue ahí.
  await switcher(page).click();
  await page.getByRole("menuitemradio", { name: new RegExp(owner.company.companyName) }).click();
  await page.goto("/es/empleados");
  await expect(page.getByText(employeeName)).toBeVisible();
  await owner.context.close();
});
