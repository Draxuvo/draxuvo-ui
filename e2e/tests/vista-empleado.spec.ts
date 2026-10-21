import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCompany, E2E_PASSWORD, uniquePrefix } from "../support/data";
import { t } from "../support/i18n";
import { knownFailure } from "../support/known-failure";
import { createOrderViaUI } from "../support/orders";
import { API_URL, authFile, storageStatePath } from "../support/session";
import { passwordToken } from "../support/tokens";

const ANON = { cookies: [], origins: [] };
// Un PNG de 1x1 para la foto de una orden o del perfil.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const wo = (key: string, values?: Record<string, string | number>) => t(`workOrders.${key}`, values);
const action = (page: Page, key: string) => page.getByRole("button", { name: wo(`actions.${key}`), exact: true });
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });

async function login(page: Page, email: string, password: string) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
}

/** Cabeceras de la sesión abierta en la página, para llamar a la API como ese usuario. */
async function apiHeaders(page: Page) {
  const { token, companyId } = await page.evaluate(() => ({
    token: localStorage.getItem("auth_token") ?? "",
    companyId: localStorage.getItem("selected_company_id") ?? "",
  }));
  return { Authorization: `Bearer ${token}`, "X-Company-Id": companyId };
}

/** El gerente de Volta crea una orden de servicio con $100 de conceptos para quien se indique y devuelve su id. */
async function managerOrder(browser: Browser, order: { title: string; assignee: string; steps?: string[] }) {
  const context = await browser.newContext({ storageState: storageStatePath("manager", "volta.demo") });
  const page = await context.newPage();
  const id = await createOrderViaUI(page, { ...order, items: [{ description: "Mano de obra", quantity: 1, price: 100 }] });
  await context.close();
  return id;
}

async function staffOf(browser: Browser) {
  const context = await browser.newContext({ storageState: storageStatePath("staff", "volta.demo") });
  return { context, page: await context.newPage() };
}

async function charge(page: Page, method: "cash" | "card") {
  await action(page, "charge").click();
  if (method === "card") {
    await page.getByRole("dialog").getByText(wo("charge.methods.card"), { exact: true }).click();
    await expect(page.getByRole("radio", { name: wo("charge.methods.card") })).toBeChecked();
  } else {
    await page.getByRole("spinbutton", { name: wo("charge.received") }).fill("100");
  }
  await page.getByRole("button", { name: wo("charge.confirm") }).click();
  await expect(page.getByText(wo("charge.success"))).toBeVisible();
  await expect(page.getByText(/Cobrado con folio T-\d+/)).toBeVisible();
}

test("[FLU-06] el trabajador asignado ve solo lo suyo, ejecuta, cobra y ve su ticket @pr", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const prefix = uniquePrefix(info.workerIndex);
  const mine = `${prefix} mía`;
  const others = `${prefix} de Luis`;
  const id = await managerOrder(browser, { title: mine, assignee: "Ana", steps: ["Revisar"] });
  await managerOrder(browser, { title: others, assignee: "Luis" });

  // 1-2. Ana entra y ve su orden, no la de Luis.
  const { context, page } = await staffOf(browser);
  await page.goto("/es/mis-ordenes");
  await expect(page.getByRole("heading", { name: wo("myOrders"), level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: `${wo("staff.open")}: ${mine}` })).toBeVisible();
  await expect(page.getByText(others)).toHaveCount(0);

  // 3. La abre, la inicia, marca el paso, la termina y la cobra en efectivo.
  await page.getByRole("link", { name: `${wo("staff.open")}: ${mine}` }).click();
  await expect(page).toHaveURL(new RegExp(`/es/mis-ordenes/${id}$`));
  for (const forbidden of ["edit", "cancel", "voidCharge", "delete"]) {
    await expect(action(page, forbidden), forbidden).toHaveCount(0);
  }
  await action(page, "start").click();
  await expect(page.getByText(wo("started"))).toBeVisible();
  await page.getByRole("checkbox", { name: wo("steps.check", { description: "Revisar" }) }).click();
  await expect(page.getByRole("checkbox", { name: wo("steps.uncheck", { description: "Revisar" }) })).toBeChecked();
  await action(page, "finish").click();
  await expect(page.getByText(wo("finished"))).toBeVisible();
  await charge(page, "cash");
  await page.getByRole("button", { name: wo("charge.done") }).click();
  await expect(page.getByText(wo("statuses.paid")).first()).toBeVisible();

  // 4. Su ticket aparece en /mis-tickets; las acciones de jefe siguen negadas (VEM-006).
  await page.goto("/es/mis-tickets");
  const ticket = page.getByRole("link").filter({ hasText: mine });
  await expect(ticket).toContainText(/T-\d+/);
  await expect(ticket).toContainText(t("tickets.statuses.paid"));
  const denied = await page.request.post(`${API_URL}/api/v1/work_orders/${id}/cancel`, {
    headers: await apiHeaders(page),
    data: { reason: "no debería poder" },
  });
  expect(denied.status()).toBe(403);
  await context.close();
});

test.describe("staff de Volta", () => {
  test.use({ storageState: storageStatePath("staff", "volta.demo") });

  test("[VEM-004] Mis órdenes: bloques, Empezar desde la lista y error de carga @pr", async ({ page, browser }, info) => {
    test.setTimeout(90_000);
    const title = `${uniquePrefix(info.workerIndex)} lista`;
    await managerOrder(browser, { title, assignee: "Ana", steps: ["Medir", "Instalar"] });

    await page.goto("/es/mis-ordenes");
    await expect(page.getByRole("heading", { name: wo("myOrders"), level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: wo("staff.active") })).toBeVisible();
    const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: `${wo("staff.open")}: ${title}` }) });
    await expect(card).toContainText(wo("statuses.open"));

    await page.getByRole("button", { name: wo("staff.startAria", { title }) }).click();
    await expect(page.getByText(wo("started"))).toBeVisible();
    await expect(card).toContainText(wo("statuses.in_progress"));
    await expect(page.getByRole("button", { name: wo("staff.startAria", { title }) })).toHaveCount(0);

    // Si la carga falla, la pantalla lo avisa.
    await page.route("**/api/v1/work_orders?*", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await page.reload();
    await expect(page.getByText(wo("loadError"))).toBeVisible();
  });

  test("[VEM-008] el detalle solo dibuja las acciones del staff y recorre la orden hasta el cobro @pr", async ({ page, browser }, info) => {
    test.setTimeout(120_000);
    const prefix = uniquePrefix(info.workerIndex);
    const title = `${prefix} detalle`;
    const steps = ["Medir", "Cortar", "Instalar"];
    const id = await managerOrder(browser, { title, assignee: "Ana", steps });
    const luisId = await managerOrder(browser, { title: `${prefix} de Luis`, assignee: "Luis" });

    await page.goto("/es/mis-ordenes");
    await page.getByRole("link", { name: `${wo("staff.open")}: ${title}` }).click();
    await expect(page).toHaveURL(new RegExp(`/es/mis-ordenes/${id}$`));
    await expect(action(page, "start")).toBeVisible();
    for (const forbidden of ["edit", "cancel", "voidCharge", "delete", "charge"]) {
      await expect(action(page, forbidden), forbidden).toHaveCount(0);
    }

    await action(page, "start").click();
    await expect(page.getByText(wo("started"))).toBeVisible();
    for (const step of steps.slice(0, 2)) {
      await page.getByRole("checkbox", { name: wo("steps.check", { description: step }) }).click();
      await expect(page.getByRole("checkbox", { name: wo("steps.uncheck", { description: step }) })).toBeChecked();
    }
    await page.getByPlaceholder(wo("notesSection.placeholder")).fill("Medido en sitio");
    await page.getByRole("button", { name: wo("notesSection.submit") }).click();
    await expect(page.getByText("Medido en sitio")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText(wo("photos.uploadSuccess"))).toBeVisible();

    // Un paso sin marcar: avisa antes de terminar.
    await action(page, "finish").click();
    // (El texto del aviso es un plural ICU que t() no resuelve: se comprueban sus botones.)
    await expect(page.getByRole("dialog").getByRole("button", { name: wo("actions.dismiss") })).toBeVisible();
    await page.getByRole("button", { name: wo("actions.finishAnyway") }).click();
    await expect(page.getByText(wo("finished"))).toBeVisible();
    await expect(action(page, "reopen")).toBeVisible();

    await charge(page, "card");
    await page.getByRole("button", { name: wo("charge.done") }).click();

    // De vuelta en la lista, la orden pasa a "Terminadas y cobradas hoy"; la de otra persona no se abre.
    await page.goto("/es/mis-ordenes");
    await expect(page.getByRole("region", { name: wo("staff.finished") }).getByRole("link", { name: `${wo("staff.open")}: ${title}` })).toBeVisible();
    await page.goto(`/es/mis-ordenes/${luisId}`);
    await expect(page.getByText(wo("notFoundTitle"))).toBeVisible();
    await expect(page.getByText(wo("notFoundDesc"))).toBeVisible();
  });

  test("[VEM-008] cada paso marcado muestra quién lo hizo @pr", async ({ page, browser }, info) => {
    knownFailure("H-29");
    test.setTimeout(90_000);
    const title = `${uniquePrefix(info.workerIndex)} pasos`;
    const id = await managerOrder(browser, { title, assignee: "Ana", steps: ["Medir"] });
    await page.goto(`/es/mis-ordenes/${id}`);
    await action(page, "start").click();
    await page.getByRole("checkbox", { name: wo("steps.check", { description: "Medir" }) }).click();
    await expect(page.getByRole("checkbox", { name: wo("steps.uncheck", { description: "Medir" }) })).toBeChecked();
    await expect(page.getByText(wo("steps.doneBy", { name: "Ana López" }))).toBeVisible();
  });

  test("[VEM-009] Mis tickets: lista, filtros por estado, búsqueda por folio y PDF @regresion", async ({ page }) => {
    await page.goto("/es/mis-tickets");
    await expect(page.getByRole("heading", { name: t("tickets.myTickets"), level: 1 })).toBeVisible();
    const first = page.getByRole("link").filter({ hasText: /T-\d+/ }).first();
    await expect(first).toBeVisible();
    const folio = (await first.textContent())?.match(/T-\d+/)?.[0] ?? "";

    const chip = (key: string) => page.getByRole("group", { name: t("tickets.filterStatus") }).getByRole("button", { name: key === "all" ? t("tickets.all") : t(`tickets.statuses.${key}`), exact: true });
    await chip("paid").click();
    await expect(chip("paid")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link").filter({ hasText: t("tickets.statuses.voided") })).toHaveCount(0);
    await chip("voided").click();
    await expect(page.getByRole("link").filter({ hasText: t("tickets.statuses.paid") })).toHaveCount(0);
    await chip("all").click();

    await page.getByPlaceholder(t("tickets.searchPlaceholder")).fill(folio);
    await expect(page.getByRole("link").filter({ hasText: /T-\d+/ })).toHaveCount(1);
    await page.getByPlaceholder(t("tickets.searchPlaceholder")).fill("zzz-sin-coincidencia");
    await expect(page.getByText(t("tickets.emptyFiltered"))).toBeVisible();

    // El ticket se abre desde su orden y el PDF baja con su folio.
    await page.getByPlaceholder(t("tickets.searchPlaceholder")).fill(folio);
    await page.getByRole("link").filter({ hasText: folio }).click();
    await action(page, "viewTicket").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: wo("charge.downloadPdf") }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^ticket-T-.*\.pdf$/);
  });
});

// Cuarentena (spec 010): falló o fue inestable en la primera corrida local. Arreglar o borrar en 14 días.
test("[VEM-010] Mi perfil del staff: datos, rol Operador, foto y apariencia @regresion @flaky", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  // Un staff nuevo en una empresa nueva: no se toca el perfil de los usuarios de demo.
  const owner = await createCompany(request, { workerIndex: info.workerIndex });
  const session = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: owner.email, password: owner.password } });
  const headers = { Authorization: `Bearer ${owner.token}`, "X-Company-Id": String((await session.json()).user.companies[0].id) };
  const email = `${uniquePrefix(info.workerIndex)}@mailinator.com`;
  const added = await request.post(`${API_URL}/api/v1/company/members`, {
    headers,
    data: { member: { email, first_name: "Sara", last_name: "Soto", phone: "5512345678", role: "staff" } },
  });
  expect(added.status()).toBe(201);
  const reset = await request.put(`${API_URL}/api/v1/passwords/update_with_token`, {
    data: {
      token: passwordToken({ id: (await added.json()).id, email, fullName: "Sara Soto" }),
      new_password: E2E_PASSWORD,
      new_password_confirmation: E2E_PASSWORD,
    },
  });
  expect(reset.ok()).toBe(true);

  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await login(page, email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/es\/mis-ordenes$/);
  await menu(page).getByRole("link", { name: t("nav.profile") }).click();
  await expect(page).toHaveURL(/\/es\/mi-perfil$/);
  await expect(page.getByRole("heading", { name: t("profile.pageTitle"), level: 1 })).toBeVisible();
  await expect(page.getByText(t("adminUsers.roles.staff"), { exact: true })).toBeVisible();

  const save = page.getByRole("button", { name: t("common.save") });
  await expect(save).toBeDisabled();
  await page.getByPlaceholder(t("profile.phonePlaceholder")).fill("5598765432");
  await save.click();
  await expect(page.getByText(t("profile.saveSuccess"))).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(t("profile.avatarUpdated"))).toBeVisible();
  await page.getByRole("button", { name: t("profile.deleteAvatar") }).click();
  await expect(page.getByText(t("profile.avatarDeleted"))).toBeVisible();

  // El tema y el modo se aplican al instante y se guardan en la cuenta.
  // Los radios están ocultos y guardan por la API: click y esperar.
  await page.getByRole("radio", { name: t("appearance.modes.dark"), exact: true }).click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await page.getByRole("radio", { name: new RegExp(`^${t("appearance.themes.grafito.name")}`) }).click({ force: true });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "grafito");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "grafito");
  await context.close();
});

test.describe("quien es staff en una empresa y dueño en otra", () => {
  test.use({ storageState: authFile("multi-demo") });

  test("[VEM-011] el rol cambia con la empresa activa, también en la API @pr", async ({ page, context }) => {
    await page.goto("/es/inicio");
    await expect(menu(page).getByRole("link", { name: t("nav.people") })).toBeVisible();
    const ids = await page.evaluate(() => {
      const companies: Array<{ id: number; name: string }> = JSON.parse(localStorage.getItem("auth-storage") ?? "{}").state.user.companies;
      return Object.fromEntries(companies.map((c) => [c.name, c.id]));
    });
    const orders = async (companyId: number) => {
      const headers = { ...(await apiHeaders(page)), "X-Company-Id": String(companyId) };
      const response = await page.request.get(`${API_URL}/api/v1/work_orders`, { headers });
      return (await response.json()).results.length as number;
    };
    expect(await orders(ids["Electricidad Volta"])).toBeGreaterThan(0);
    expect(await orders(ids["Restaurante Sazón"])).toBe(0);

    await page.getByRole("button", { name: /Cambiar de empresa/ }).click();
    await page.getByRole("menuitemradio", { name: /Restaurante Sazón/ }).click();
    await expect(page).toHaveURL(/\/es\/mis-ordenes$/);
    expect((await context.cookies()).find((c) => c.name === "user_role")?.value).toBe("staff");
    await expect(menu(page).getByRole("link")).toHaveText([wo("myOrders"), t("tickets.myTickets"), t("nav.profile")]);
    for (const route of ["ordenes", "equipo", "inventario"]) {
      await page.goto(`/es/${route}`).catch(() => {});
      await expect(page, route).toHaveURL(/\/es\/mis-ordenes$/);
    }
    // Sin empleado ligado en Sazón no ve órdenes ni tickets.
    await expect(page.getByText(wo("staff.empty"))).toBeVisible();
    await page.goto("/es/mis-tickets");
    await expect(page.getByText(t("tickets.empty"))).toBeVisible();

    await page.getByRole("button", { name: /Cambiar de empresa/ }).click();
    await page.getByRole("menuitemradio", { name: /Electricidad Volta/ }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);
    await expect(menu(page).getByRole("link", { name: t("nav.people") })).toBeVisible();
  });
});

test.describe("staff de una empresa sin el módulo", () => {
  test.use({ storageState: storageStatePath("staff", "donchuy.demo") });

  test("[VEM-012] en Don Chuy (plan Básico) Mis órdenes dice que el módulo no está en el plan y la API lo niega @regresion", async ({ page }) => {
    await page.goto("/es/mis-ordenes");
    await expect(page.getByText(t("subscription.moduleLocked"))).toBeVisible();
    await expect(page.getByText(t("subscription.moduleLockedDesc", { module: t("modules.work_orders") }))).toBeVisible();
    // El staff no administra la suscripción: sin botón para mejorar el plan.
    await expect(page.getByRole("link", { name: t("subscription.upgradePlan") })).toHaveCount(0);
    const response = await page.request.get(`${API_URL}/api/v1/work_orders`, { headers: await apiHeaders(page) });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.details.code).toBe("module_not_in_plan");
  });
});

test.describe("staff de una empresa sin el módulo de tickets", () => {
  test.use({ storageState: storageStatePath("staff", "donchuy.demo") });

  test("[VEM-012] en Don Chuy Mis tickets dice que el módulo no está en el plan, sin ofrecer mejorarlo @regresion", async ({ page }) => {
    knownFailure("H-30");
    await page.goto("/es/mis-tickets");
    await expect(page.getByText(t("subscription.moduleLocked"))).toBeVisible();
    await expect(page.getByText(t("tickets.loadError"))).toHaveCount(0);
    await expect(page.getByRole("button", { name: t("api.moduleNotInPlanAction") })).toHaveCount(0);
  });
});

test.describe("staff de una empresa con la suscripción vencida", () => {
  test.use({ storageState: storageStatePath("staff", "plomeria.demo") });

  test("[VEM-012] en Plomería el staff ve el aviso de suscripción vencida @regresion", async ({ page }) => {
    knownFailure("H-07");
    await page.goto("/es/mis-ordenes");
    const response = await page.request.get(`${API_URL}/api/v1/work_orders`, { headers: await apiHeaders(page) });
    expect(response.status()).toBe(403);
    await expect(page.getByRole("dialog").getByText(t("subscription.blockedTitleExpired"))).toBeVisible();
    await expect(page.getByRole("dialog").getByText(t("subscription.blockedDescMember"))).toBeVisible();
  });
});
