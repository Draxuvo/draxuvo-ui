import { expect, test, type Locator, type Page } from "@playwright/test";
import { createCompany, uniquePrefix } from "../support/data";
import { t } from "../support/i18n";
import { knownFailure } from "../support/known-failure";
import { API_URL, DEMO_PASSWORD, authFile } from "../support/session";
import { FAKE_CHECKOUT_URL, mockStripeRedirects } from "../support/stripe";

test.use({ storageState: authFile("super_admin-draxuvo") });

const ANON = { cookies: [], origins: [] };
const sa = (key: string, values?: Record<string, string | number>) => t(`adminSubscriptions.${key}`, values);
const co = (key: string, values?: Record<string, string | number>) => t(`companies.${key}`, values);
const us = (key: string, values?: Record<string, string | number>) => t(`adminUsers.${key}`, values);
const board = (key: string) => t(`analyticsBoard.${key}`);
const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
/** Los dos íconos del final de cada fila (sin nombre accesible, solo tooltip): editar y eliminar. */
const edit = (r: Locator) => r.getByRole("button").nth(-2);
const remove = (r: Locator) => r.getByRole("button").last();
const filter = (page: Page, key: string) => page.getByRole("button", { name: sa(key), exact: true });

/** Empresa nueva (plan Pro, en prueba) con su id: la lista de empresas va de la más nueva a la más vieja, así que sale arriba. */
async function newCompany(request: Parameters<typeof createCompany>[0], workerIndex: number) {
  const company = await createCompany(request, { workerIndex, plan: "pro" });
  const login = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: company.email, password: company.password } });
  return { ...company, id: (await login.json()).user.companies[0].id as number };
}

test("[SAD-010] la lista de empresas trae sus columnas y el estado de la suscripción @regresion", async ({ page, request }, info) => {
  const company = await newCompany(request, info.workerIndex);
  await page.goto("/es/empresas");
  await expect(page.getByRole("heading", { name: co("title"), level: 1 })).toBeVisible();
  for (const column of ["name", "plan", "subscription", "users"]) {
    await expect(page.getByRole("columnheader", { name: co(column), exact: true })).toBeVisible();
  }
  await expect(row(page, company.companyName)).toContainText(co("subTrial"));
  await expect(row(page, company.companyName)).toContainText(co("plans.pro"));
  // Resumen de módulos (spec 017): una empresa Pro nueva tiene 8 de 8 activos (con Terminales, spec 030).
  await expect(page.getByRole("columnheader", { name: co("modules.column"), exact: true })).toBeVisible();
  await expect(row(page, company.companyName)).toContainText("8/8");
});

test("[SAD-014] el super admin desactiva un módulo de una empresa y el dueño deja de verlo @pr", async ({ page, request, browser }, info) => {
  test.setTimeout(90_000);
  const company = await newCompany(request, info.workerIndex);

  // 1. Abre los módulos de la empresa: solo los de su plan, con interruptor.
  await page.goto("/es/empresas");
  await page.getByPlaceholder(co("searchPlaceholder")).fill(company.companyName);
  await expect(row(page, company.companyName)).toContainText("8/8");
  await row(page, company.companyName).getByRole("button", { name: co("modules.open", { name: company.companyName }) }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(co("modules.title", { name: company.companyName }))).toBeVisible();
  await expect(sheet.getByRole("switch")).toHaveCount(8);

  // 2. Desactiva Inventario: avisa, el resumen baja y queda registrado por la API.
  await sheet.getByRole("switch", { name: t("modules.inventory") }).click();
  await expect(page.getByText(co("modules.saved"))).toBeVisible();
  await expect(sheet.getByRole("switch", { name: t("modules.inventory") })).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(row(page, company.companyName)).toContainText("7/8");

  // 3. El dueño de esa empresa ya no ve Inventario en el menú.
  const ownerContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const owner = await ownerContext.newPage();
  await owner.goto("/es/login");
  await owner.getByLabel(t("auth.email"), { exact: true }).fill(company.email);
  await owner.getByLabel(t("auth.password"), { exact: true }).fill(company.password);
  await owner.getByRole("button", { name: t("auth.submit") }).click();
  await expect(owner).toHaveURL(/\/es\/inicio$/);
  await expect(owner.getByRole("navigation", { name: t("nav.mainNav") }).getByRole("link", { name: t("nav.inventory") })).toHaveCount(0);
  await ownerContext.close();
});

// Cuarentena (spec 010): falló o fue inestable en la primera corrida local. Arreglar o borrar en 14 días.
test("[SAD-010] crear, editar y eliminar una empresa desde la pantalla @regresion @flaky", async ({ page }, info) => {
  const prefix = uniquePrefix(info.workerIndex);
  const name = `Taquería ${prefix}`;
  await page.goto("/es/empresas");

  await page.getByRole("button", { name: co("new") }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: co("save") }).click();
  await expect(sheet.getByText(co("nameRequired"))).toBeVisible();
  await sheet.getByPlaceholder(co("namePlaceholder")).fill(name);
  await sheet.getByRole("button", { name: co("save") }).click();
  await expect(page.getByText(co("createSuccess"))).toBeVisible();
  await expect(row(page, name)).toBeVisible();

  await edit(row(page, name)).click();
  await expect(page.getByRole("dialog").getByText(co("editTitle"))).toBeVisible();
  await page.getByRole("dialog").getByPlaceholder(co("namePlaceholder")).fill(`${name} II`);
  await page.getByRole("dialog").getByRole("button", { name: co("save") }).click();
  await expect(page.getByText(co("updateSuccess"))).toBeVisible();
  await expect(row(page, `${name} II`)).toBeVisible();

  await remove(row(page, `${name} II`)).click();
  await expect(page.getByRole("dialog").getByText(co("deleteConfirm", { name: `${name} II` }))).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: co("delete"), exact: true }).click();
  await expect(page.getByText(co("deleteSuccess"))).toBeVisible();
  await expect(row(page, `${name} II`)).toHaveCount(0);
});

// Cuarentena (spec 010): inestable en la regresión local. Arreglar o borrar en 14 días.
test("[SAD-010] la búsqueda por nombre filtra la lista de empresas @regresion @flaky", async ({ page, request }, info) => {
  knownFailure("H-18");
  const company = await newCompany(request, info.workerIndex);
  await page.goto("/es/empresas");
  await page.getByPlaceholder(co("searchPlaceholder")).fill(company.prefix);
  await expect(row(page, company.companyName)).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);
});

test("[SAD-011] usuarios: crear con empresa, activar, editar y eliminar @regresion", async ({ page }, info) => {
  test.setTimeout(90_000);
  const prefix = uniquePrefix(info.workerIndex);
  const email = `${prefix}@mailinator.com`;
  await page.goto("/es/usuarios");
  await expect(page.getByRole("heading", { name: us("title"), level: 1 })).toBeVisible();

  await page.getByRole("button", { name: us("new") }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(us("createEmailNotice"))).toBeVisible();
  // El botón Guardar queda fuera de la pantalla (H-22): el formulario se envía con Enter.
  await sheet.getByPlaceholder(us("firstNamePlaceholder"), { exact: true }).press("Enter");
  for (const key of ["firstNameRequired", "lastNameRequired", "secondLastNameRequired", "phoneRequired", "emailInvalid"]) {
    await expect(sheet.getByText(us(key))).toBeVisible();
  }

  await sheet.getByPlaceholder(us("firstNamePlaceholder"), { exact: true }).fill("Nora");
  await sheet.getByPlaceholder(us("lastNamePlaceholder"), { exact: true }).fill(prefix);
  await sheet.getByPlaceholder(us("secondLastNamePlaceholder"), { exact: true }).fill("Soto");
  await sheet.getByPlaceholder(us("phonePlaceholder"), { exact: true }).fill("5512345678");
  await sheet.getByPlaceholder(us("emailPlaceholder"), { exact: true }).fill(email);
  await sheet.getByRole("combobox").first().selectOption({ label: us("roles.admin") });
  await sheet.getByRole("checkbox").first().evaluate((input: HTMLInputElement) => input.click());
  await sheet.getByPlaceholder(us("emailPlaceholder"), { exact: true }).press("Enter");
  await expect(page.getByText(us("createSuccess"), { exact: true })).toBeVisible();
  await expect(page.getByText(us("createEmailSent"))).toBeVisible();

  await page.getByPlaceholder(us("searchPlaceholder")).fill(prefix);
  const created = row(page, email);
  await expect(created).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(created).not.toContainText(us("noCompany"));

  const toggle = created.getByRole("switch");
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(page.getByText(us("deactivateSuccess"))).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(page.getByText(us("activateSuccess"))).toBeVisible();

  await edit(created).click();
  // El formulario se llena cuando llega el usuario: se espera antes de escribir.
  await expect(page.getByRole("dialog").getByPlaceholder(us("firstNamePlaceholder"), { exact: true })).toHaveValue("Nora");
  await page.getByRole("dialog").getByPlaceholder(us("phonePlaceholder"), { exact: true }).fill("5598765432");
  await page.getByRole("dialog").getByPlaceholder(us("phonePlaceholder"), { exact: true }).press("Enter");
  await expect(page.getByText(us("updateSuccess"))).toBeVisible();

  await remove(created).click();
  await expect(page.getByRole("dialog").getByText(us("deleteConfirm", { name: `Nora ${prefix}` }))).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: us("delete"), exact: true }).click();
  await expect(page.getByText(us("deleteSuccess"))).toBeVisible();
  await expect(created).toHaveCount(0);
});

test("[SAD-011] el rol que se elige al crear un usuario queda guardado @regresion", async ({ page }, info) => {
  knownFailure("H-27");
  const prefix = uniquePrefix(info.workerIndex);
  const email = `${prefix}@mailinator.com`;
  await page.goto("/es/usuarios");
  await page.getByRole("button", { name: us("new") }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder(us("firstNamePlaceholder"), { exact: true }).fill("Rosa");
  await sheet.getByPlaceholder(us("lastNamePlaceholder"), { exact: true }).fill(prefix);
  await sheet.getByPlaceholder(us("secondLastNamePlaceholder"), { exact: true }).fill("Soto");
  await sheet.getByPlaceholder(us("phonePlaceholder"), { exact: true }).fill("5512345678");
  await sheet.getByPlaceholder(us("emailPlaceholder"), { exact: true }).fill(email);
  await sheet.getByRole("combobox").first().selectOption({ label: us("roles.admin") });
  await sheet.getByRole("checkbox").first().evaluate((input: HTMLInputElement) => input.click());
  await sheet.getByPlaceholder(us("emailPlaceholder"), { exact: true }).press("Enter");
  await expect(page.getByText(us("createSuccess"), { exact: true })).toBeVisible();

  await page.getByPlaceholder(us("searchPlaceholder")).fill(prefix);
  await expect(row(page, email)).toContainText(us("roles.admin"));
});

test("[SAD-011] el botón Guardar del formulario de usuario se alcanza en una pantalla de 720 px @regresion", async ({ page }) => {
  knownFailure("H-28");
  await page.goto("/es/usuarios");
  await page.getByRole("button", { name: us("new") }).click();
  // La lista de empresas del formulario carga después: con ella el formulario ya tiene su altura final.
  await expect(page.getByRole("dialog").getByRole("checkbox").first()).toBeAttached();
  const save = page.getByRole("dialog").getByRole("button", { name: us("save") });
  await expect(save).toBeVisible();
  await expect(save).toBeInViewport();
});

// Cuarentena (spec 010): falló o fue inestable en la primera corrida local. Arreglar o borrar en 14 días.
test("[SAD-012] suscripciones: estado, filtros, iniciar pago y cancelar plan de una empresa @regresion @flaky", async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const company = await newCompany(request, info.workerIndex);
  await mockStripeRedirects(page);
  // La pestaña de Stripe se abre aparte: el destino falso también se responde a nivel de contexto.
  await page.context().route(/https:\/\/checkout\.stripe\.test\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>stripe</body></html>" }),
  );

  // Se puede cambiar lo que la API dice de esta empresa para ver cada estado sin tocar Stripe.
  let override: Record<string, unknown> = {};
  await page.route("**/api/v1/subscription", async (route) => {
    const request = route.request();
    if (request.method() !== "GET" || request.headers()["x-company-id"] !== String(company.id)) return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), ...override } });
  });

  await page.goto("/es/suscripciones");
  await expect(page.getByRole("heading", { name: sa("pageTitle"), level: 1 })).toBeVisible();
  for (const column of ["colCompany", "colPlan", "colStatus", "colExpiry", "colDaysLeft", "colActions"]) {
    await expect(page.getByRole("columnheader", { name: sa(column), exact: true })).toBeVisible();
  }
  const mine = row(page, company.companyName);
  await expect(mine).toContainText(sa("statusTrial"));
  await expect(mine.getByRole("button", { name: sa("cancelBtn") })).toHaveCount(0);

  // Los filtros dejan o quitan la fila según su estado.
  await filter(page, "filterTrial").click();
  await expect(mine).toBeVisible();
  for (const key of ["filterActive", "filterExpiringSoon", "filterExpired", "filterPastDue"]) {
    await filter(page, key).click();
    await expect(mine, key).toHaveCount(0);
  }
  await filter(page, "filterAll").click();
  await expect(mine).toBeVisible();

  // Iniciar pago: plan y periodicidad, y se abre Stripe en otra pestaña.
  await mine.getByRole("button", { name: sa("checkoutBtn") }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(sa("checkoutTitle", { company: company.companyName }))).toBeVisible();
  await dialog.getByRole("button", { name: sa("planEnterprise"), exact: true }).click();
  await dialog.getByRole("button", { name: t("plans.annual"), exact: true }).click();
  const checkout = page.waitForRequest((r) => r.url().endsWith("/subscription/checkout"));
  const popup = page.waitForEvent("popup");
  await dialog.getByRole("button", { name: sa("checkoutConfirm") }).click();
  const sent = await checkout;
  expect(sent.postDataJSON()).toMatchObject({ plan: "enterprise", billing_cycle: "annual" });
  expect(sent.headers()["x-company-id"]).toBe(String(company.id));
  await expect(page.getByText(sa("checkoutSuccess"))).toBeVisible();
  await (await popup).waitForURL(FAKE_CHECKOUT_URL);

  // Una empresa vencida y otra activa, como las vería el super admin.
  override = { status: "expired", trial_ends_at: new Date(Date.now() - 3 * 86_400_000).toISOString() };
  await page.reload();
  await expect(mine).toContainText(sa("statusExpired"));
  await expect(mine).toContainText(sa("expiredDays", { days: 3 }));
  await filter(page, "filterExpired").click();
  await expect(mine).toBeVisible();

  override = { status: "active", trial_ends_at: null, current_period_end: new Date(Date.now() + 20 * 86_400_000).toISOString() };
  await page.reload();
  await expect(mine).toContainText(sa("statusActive"));
  await mine.getByRole("button", { name: sa("cancelBtn") }).click();
  await expect(page.getByRole("dialog").getByText(sa("cancelScheduledDesc", { company: company.companyName }))).toBeVisible();
  // Sin suscripción de Stripe la API rechaza la cancelación.
  await page.getByRole("dialog").getByRole("button", { name: sa("cancelConfirm") }).click();
  await expect(page.getByText(sa("cancelError"))).toBeVisible();
  // Con una suscripción de Stripe, queda programada.
  await page.route("**/api/v1/subscription", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ cancel_at_period_end: true }) })
      : route.fallback(),
  );
  await page.getByRole("dialog").getByRole("button", { name: sa("cancelConfirm") }).click();
  await expect(page.getByText(sa("cancelScheduledSuccess"))).toBeVisible();
});

test("[SAD-013] estadísticas y reportes de cualquier empresa, con las cifras de esa empresa @regresion", async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const withStaff = await newCompany(request, info.workerIndex);
  const empty = await newCompany(request, info.workerIndex);
  const login = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: withStaff.email, password: withStaff.password } });
  const employee = await request.post(`${API_URL}/api/v1/employees`, {
    headers: { Authorization: `Bearer ${(await login.json()).token}`, "X-Company-Id": String(withStaff.id) },
    data: { employee: { name: `Empleado ${withStaff.prefix}` } },
  });
  expect(employee.status()).toBe(201);
  const company = (name: string) => page.getByRole("combobox").selectOption({ label: name });
  const card = (label: string) => page.getByText(label, { exact: true }).locator("xpath=preceding-sibling::p[1]");

  await page.goto("/es/estadisticas");
  await expect(page.getByText(board("selectCompanyHint"))).toBeVisible();
  await company(withStaff.companyName);
  await expect(card(board("totalEmployees"))).toHaveText("1");
  await expect(page.getByText(board("totalUsers"), { exact: true })).toBeVisible();
  await company(empty.companyName);
  await expect(card(board("totalEmployees"))).toHaveText("0");

  await page.goto("/es/reportes");
  await expect(page.getByText(co("selectCompanyPrompt"))).toBeVisible();
  await company(empty.companyName);
  await expect(page.getByRole("button", { name: t("reports.tabSummary"), exact: true })).toBeVisible();
});

test("[FLU-10] el super admin crea una empresa, la consulta sin frenos y desactiva a un usuario @regresion", async ({ page, request, browser }, info) => {
  test.setTimeout(120_000);
  const prefix = uniquePrefix(info.workerIndex);
  const owner = await newCompany(request, info.workerIndex);

  // 1-2. Llega a /empresas y crea una empresa.
  await page.goto("/es/empresas");
  await page.getByRole("button", { name: co("new") }).click();
  await page.getByRole("dialog").getByPlaceholder(co("namePlaceholder")).fill(`Flujo ${prefix}`);
  await page.getByRole("dialog").getByRole("button", { name: co("save") }).click();
  await expect(page.getByText(co("createSuccess"))).toBeVisible();
  await expect(row(page, `Flujo ${prefix}`)).toContainText(co("subTrial"));

  // 3. Entra a una empresa con la prueba vencida (Plomería) sin la puerta de suscripción.
  const demo = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: "dueno@plomeria.demo", password: DEMO_PASSWORD } });
  const expiredId = (await demo.json()).user.companies[0].id;
  const adminToken = await page.evaluate(() => localStorage.getItem("auth_token"));
  const asSuperAdmin = { Authorization: `Bearer ${adminToken}`, "X-Company-Id": String(expiredId) };
  expect((await request.get(`${API_URL}/api/v1/employees`, { headers: asSuperAdmin })).status()).toBe(200);
  const ownerSession = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: "dueno@plomeria.demo", password: DEMO_PASSWORD } });
  expect((await request.get(`${API_URL}/api/v1/employees`, { headers: { Authorization: `Bearer ${(await ownerSession.json()).token}`, "X-Company-Id": String(expiredId) } })).status()).toBe(403);

  // 4. Estadísticas de la empresa nueva.
  await page.goto("/es/estadisticas");
  await page.getByRole("combobox").selectOption({ label: owner.companyName });
  await expect(page.getByText(board("totalEmployees"), { exact: true })).toBeVisible();

  // 5. Desactiva al dueño de esa empresa y ya no puede iniciar sesión.
  await page.goto("/es/usuarios");
  await page.getByPlaceholder(us("searchPlaceholder")).fill(owner.prefix);
  await expect(row(page, owner.email)).toBeVisible();
  await row(page, owner.email).getByRole("switch").click();
  await expect(page.getByText(us("deactivateSuccess"))).toBeVisible();

  const blocked = await browser.newContext({ storageState: ANON });
  const loginPage = await blocked.newPage();
  await loginPage.goto("/es/login");
  await loginPage.getByLabel(t("auth.email"), { exact: true }).fill(owner.email);
  await loginPage.getByLabel(t("auth.password"), { exact: true }).fill(owner.password);
  await loginPage.getByRole("button", { name: t("auth.submit") }).click();
  await expect(loginPage.getByText(/Cuenta inactiva/)).toBeVisible();
  await expect(loginPage).toHaveURL(/\/es\/login$/);
  await blocked.close();

  // Caso negativo: un dueño recibe 403 en empresas y usuarios (SAD-001, SAD-002).
  for (const path of ["companies", "users"]) {
    const denied = await request.get(`${API_URL}/api/v1/${path}`, { headers: { Authorization: `Bearer ${owner.token}`, "X-Company-Id": String(owner.id) } });
    expect(denied.status(), path).toBe(403);
  }
});
