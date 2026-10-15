import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { createCompany, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { knownFailure } from "../support/known-failure";
import { createOrderViaUI } from "../support/orders";
import { API_URL, storageStatePath } from "../support/session";

const ANON = { cookies: [], origins: [] };
const board = (key: string, values?: Record<string, string | number>) => t(`analyticsBoard.${key}`, values);
const rep = (key: string, values?: Record<string, string | number>) => t(`reports.${key}`, values);
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });
const tab = (page: Page, key: string) => page.getByRole("button", { name: rep(key), exact: true });
/** Entrada de fecha o selector: la etiqueta es un texto hermano, no un <label for>. */
const control = (page: Page, label: string, tag: "input" | "select"): Locator =>
  page.getByText(label, { exact: true }).locator(`xpath=following-sibling::${tag}`);
const legend = (page: Page, chart: string) => page.getByRole("list", { name: board("legendLabel", { chart: board(chart) }) });
const stat = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("xpath=..");

async function login(page: Page, email: string, password: string) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
}

async function ownerOf(browser: Browser, company: NewCompany) {
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await login(page, company.email, company.password);
  await expect(page).toHaveURL(/\/es\/inicio$/);
  const companyId = await page.evaluate(() => localStorage.getItem("selected_company_id") ?? "");
  return { context, page, headers: { Authorization: `Bearer ${company.token}`, "X-Company-Id": companyId } };
}

test.describe("manager de Volta", () => {
  test.use({ storageState: storageStatePath("manager", "volta.demo") });

  test("[REP-010] el dashboard muestra tarjetas y gráficas y cada una lleva a su lista filtrada @regresion", async ({ page }) => {
    await page.goto("/es/dashboard");
    await expect(page.getByRole("heading", { name: board("title"), level: 1 })).toBeVisible();
    for (const label of ["totalEmployees", "totalWorkOrders", "totalTickets", "collected", "products", "lowStock", "attendanceToday"]) {
      await expect(page.getByText(board(label), { exact: true }).first()).toBeVisible();
    }
    // Reportes es solo de owner y admin.
    await expect(page.getByRole("link", { name: board("aria.reports") })).toHaveCount(0);
    for (const chart of ["chartOrdersByStatus", "chartOrdersByPriority", "chartTickets"]) {
      await expect(page.getByRole("heading", { name: board(chart) })).toBeVisible();
      await expect(legend(page, chart)).toBeVisible();
    }

    await page.locator('a[href$="/inventario?low_stock=true"]').first().click();
    await expect(page).toHaveURL(/\/es\/inventario\?.*low_stock=true/);
    await page.goBack();

    await legend(page, "chartOrdersByStatus").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/es\/ordenes\?.*status=/);
    await page.goBack();

    // Una barra de la gráfica navega igual que su leyenda.
    await page.locator("section").filter({ has: page.getByRole("heading", { name: board("chartOrdersByStatus") }) })
      .locator('rect[data-testid^="bar.item.value"]:not([height="0"])').first().click();
    await expect(page).toHaveURL(/\/es\/ordenes\?.*status=/);
  });

  test("[REP-010] el botón de actualizar vuelve a pedir el dashboard y un fallo ofrece reintentar @regresion", async ({ page }) => {
    let calls = 0;
    let failing = false;
    await page.route("**/api/v1/dashboard", (route) => {
      calls += 1;
      return failing ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.fallback();
    });
    await page.goto("/es/dashboard");
    await expect(page.getByText(board("totalEmployees"), { exact: true })).toBeVisible();
    const before = calls;
    await page.getByRole("button", { name: t("common.refresh") }).click();
    await expect.poll(() => calls).toBeGreaterThan(before);

    failing = true;
    await page.getByRole("button", { name: t("common.refresh") }).click();
    await expect(page.getByText(board("empty.loadError"))).toBeVisible();
    failing = false;
    await page.getByRole("button", { name: t("common.retry") }).click();
    await expect(page.getByText(board("totalEmployees"), { exact: true })).toBeVisible();
  });

  test("[REP-011] el manager no ve Reportes en el menú y por URL la API le niega los datos @regresion", async ({ page }) => {
    await page.goto("/es/inicio");
    await expect(menu(page).getByRole("link", { name: t("nav.reports") })).toHaveCount(0);
    const denied = page.waitForResponse((r) => r.url().includes("/api/v1/reports/summary"));
    await page.goto("/es/reportes");
    expect((await denied).status()).toBe(403);
  });
});

test.describe("dueño de Don Chuy (plan Básico)", () => {
  test.use({ storageState: storageStatePath("owner", "donchuy.demo") });

  test("[REP-010] el dashboard solo trae las secciones de los módulos del plan @regresion", async ({ page }) => {
    await page.goto("/es/dashboard");
    for (const label of ["totalEmployees", "products", "lowStock", "attendanceToday"]) {
      await expect(page.getByText(board(label), { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(board("totalWorkOrders"), { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: board("chartOrdersByStatus") })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: board("chartInventory") })).toBeVisible();
  });

  test("[REP-011] sin el módulo en el plan, Reportes muestra el bloqueo @regresion", async ({ page }) => {
    await page.goto("/es/reportes");
    await expect(page.getByText(t("subscription.moduleLocked"))).toBeVisible();
    await expect(page.getByText(t("subscription.moduleLockedDesc", { module: t("modules.reports") }))).toBeVisible();
  });
});

test("[REP-010] sin módulos activos el dashboard lo dice y ofrece ver los planes @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const owner = await ownerOf(browser, company);
  const off = await request.patch(`${API_URL}/api/v1/company/modules`, {
    headers: owner.headers,
    data: { disabled_modules: ["employees", "attendance", "inventory"] },
  });
  expect(off.ok()).toBe(true);

  await owner.page.goto("/es/dashboard");
  await expect(owner.page.getByText(board("empty.noModules"))).toBeVisible();
  await expect(owner.page.getByRole("link", { name: board("empty.viewPlans") })).toBeVisible();
  await owner.context.close();
});

test.describe("staff de Volta", () => {
  test.use({ storageState: storageStatePath("staff", "volta.demo") });

  test("[REP-010] el staff no llega al dashboard @regresion", async ({ page }) => {
    await page.goto("/es/dashboard").catch(() => {});
    await expect(page).toHaveURL(/\/es\/mis-ordenes$/);
  });
});

test.describe("admin de Volta", () => {
  test.use({ storageState: storageStatePath("admin", "volta.demo") });

  test("[REP-011] las cuatro pestañas de Reportes, el resumen por periodo y los rangos sin datos @regresion", async ({ page }) => {
    await page.goto("/es/inicio");
    await menu(page).getByRole("link", { name: t("nav.reports") }).click();
    await expect(page).toHaveURL(/\/es\/reportes$/);
    await expect(page.getByRole("heading", { name: rep("title"), level: 1 })).toBeVisible();
    for (const key of ["tabSummary", "tabIncome", "tabExpenses", "tabPayroll"]) {
      await expect(tab(page, key)).toBeVisible();
    }

    // Resumen: cobrado, órdenes, gastos con nómina y asistencia; cambia de periodo y de fecha de referencia.
    for (const label of ["income.paid", "workOrders.total", "expenses.total", "attendance.total"]) {
      await expect(page.getByText(rep(label), { exact: true }).first()).toBeVisible();
    }
    for (const period of ["periodWeekly", "periodAnnual"]) {
      const summary = page.waitForResponse((r) => r.url().includes("/reports/summary"));
      await page.getByRole("button", { name: rep(period), exact: true }).click();
      expect((await summary).url()).toContain(`period=${period.slice(6).toLowerCase()}`);
    }
    const reference = page.waitForResponse((r) => r.url().includes("/reports/summary") && r.url().includes("date=2026-01-15"));
    await control(page, rep("date"), "input").fill("2026-01-15");
    await reference;

    // Ingresos: el detalle de tickets pagados y la agrupación.
    await tab(page, "tabIncome").click();
    await expect(page.getByText(rep("income.tableTitle"))).toBeVisible();
    await expect(page.getByRole("columnheader", { name: rep("income.colFolio") }).or(page.getByText(rep("income.empty")))).toBeVisible();
    for (const group of ["groupByWeek", "groupByYear", "groupByMonth"]) {
      await control(page, rep("groupBy"), "select").selectOption({ label: rep(group) });
    }
    await control(page, rep("from"), "input").fill("2000-01-01");
    await control(page, rep("to"), "input").fill("2000-01-31");
    await expect(page.getByText(rep("income.empty"))).toBeVisible();
    await expect(page.getByText(rep("noData"))).toBeVisible();

    // Gastos y nómina.
    await tab(page, "tabExpenses").click();
    await expect(page.getByText(rep("expenses.payrollTitle"))).toBeVisible();
    await expect(page.getByText(rep("expenses.inventoryTitle"))).toBeVisible();
    await tab(page, "tabPayroll").click();
    await expect(page.getByText(rep("payroll.subtitle"))).toBeVisible();
    await expect(page.getByRole("columnheader", { name: rep("payroll.colDays") })).toBeVisible();
    // La nómina lista a los empleados activos con sus días y horas.
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });

  test("[REP-011] el resumen y los ingresos muestran lo cobrado y el detalle de tickets @regresion", async ({ page }) => {
    knownFailure("H-25");
    await page.goto("/es/reportes");
    await expect(stat(page, rep("income.paid")).first()).not.toContainText(/^\$0\b/);
    await tab(page, "tabIncome").click();
    await expect(page.getByRole("row").filter({ hasText: /T-\d+/ }).first()).toBeVisible();
  });
});

test("[FLU-09] tras cobrar una orden, el dashboard y los reportes suman el ingreso @regresion", async ({ browser, request }, info) => {
  knownFailure("H-26");
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
  const owner = await ownerOf(browser, company);
  const { page } = owner;
  const title = `${uniquePrefix(info.workerIndex)} cobro`;
  const action = (key: string) => page.getByRole("button", { name: t(`workOrders.actions.${key}`) });

  // 1. Crea una orden de $100, la termina y la cobra en efectivo (ORD-010).
  await createOrderViaUI(page, { title, items: [{ description: "Mano de obra", quantity: 1, price: 100 }] });
  await action("start").click();
  await expect(page.getByText(t("workOrders.started"))).toBeVisible();
  await action("finish").click();
  await expect(page.getByText(t("workOrders.finished"))).toBeVisible();
  await action("charge").click();
  await page.getByRole("spinbutton", { name: t("workOrders.charge.received") }).fill("100");
  await page.getByRole("button", { name: t("workOrders.charge.confirm") }).click();
  await expect(page.getByText(t("workOrders.charge.success"))).toBeVisible();
  await page.getByRole("button", { name: t("workOrders.charge.done") }).click();

  // 2. El dashboard muestra lo cobrado y el ticket pagado.
  await page.goto("/es/dashboard");
  await expect(page.getByRole("region", { name: board("kpis") }).getByRole("link", { name: board("aria.revenue", { amount: "$100" }) })).toBeVisible();

  // 3. El resumen del periodo trae el cobro y el reporte de ingresos lista el ticket (REP-001, REP-004).
  await page.goto("/es/reportes");
  await expect(stat(page, rep("income.paid")).first()).toContainText("$100");
  await tab(page, "tabIncome").click();
  const ticket = page.getByRole("row").filter({ hasText: title });
  await expect(ticket).toHaveCount(1);
  await expect(ticket).toContainText(/T-\d+/);
  await expect(ticket).toContainText("$100");

  // 4. Un periodo sin cobros queda vacío (REP-007).
  await control(page, rep("from"), "input").fill("2000-01-01");
  await control(page, rep("to"), "input").fill("2000-01-31");
  await expect(page.getByText(rep("income.empty"))).toBeVisible();
  await owner.context.close();
});
