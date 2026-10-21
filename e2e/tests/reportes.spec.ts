import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCompany, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { setDisabledModules } from "../support/modules";
import { createOrderViaUI } from "../support/orders";
import { storageStatePath } from "../support/session";

const ANON = { cookies: [], origins: [] };
const board = (key: string, values?: Record<string, string | number>) => t(`analyticsBoard.${key}`, values);
const rep = (key: string, values?: Record<string, string | number>) => t(`reports.${key}`, values);
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });
const tab = (page: Page, key: string) => page.getByRole("button", { name: rep(key), exact: true });
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
  // Solo el super admin apaga módulos (spec 017).
  await setDisabledModules(request, owner.headers["X-Company-Id"], ["employees", "attendance", "inventory"]);

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

  test("[REP-011] las cuatro pestañas de Reportes, el periodo único y los rangos sin datos @regresion", async ({ page }) => {
    await page.goto("/es/inicio");
    await menu(page).getByRole("link", { name: t("nav.reports") }).click();
    await expect(page).toHaveURL(/\/es\/reportes$/);
    await expect(page.getByRole("heading", { name: rep("title"), level: 1 })).toBeVisible();
    for (const key of ["tabSummary", "tabIncome", "tabExpenses", "tabPayroll"]) {
      await expect(tab(page, key)).toBeVisible();
    }

    // Resumen: una cifra principal de lo cobrado y las demás debajo.
    for (const label of ["summary.collected", "summary.expenses"]) {
      await expect(page.getByText(rep(label), { exact: true }).first()).toBeVisible();
    }

    // Periodo único: un atajo cambia el rango de la consulta y queda en la URL.
    const last = new Date();
    last.setDate(0);
    const firstOfLast = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-01`;
    const summary = page.waitForResponse((r) => r.url().includes("/reports/summary") && r.url().includes(`from=${firstOfLast}`));
    await page.getByRole("button", { name: rep("period.mes-anterior"), exact: true }).click();
    await summary;
    await expect(page).toHaveURL(/rango=mes-anterior/);

    // El periodo se conserva en las demás pestañas.
    await tab(page, "tabIncome").click();
    await expect(page.getByText(rep("income.tableTitle")).or(page.getByText(rep("state.emptyTitle")))).toBeVisible();
    await expect(page.getByRole("button", { name: rep("period.mes-anterior"), exact: true })).toHaveAttribute("aria-pressed", "true");
    await tab(page, "tabExpenses").click();
    await expect(page.getByText(rep("expenses.payrollTitle"))).toBeVisible();
    await expect(page.getByText(rep("expenses.inventoryTitle"))).toBeVisible();
    await tab(page, "tabPayroll").click();
    await expect(page.getByText(rep("payroll.subtitle"))).toBeVisible();
    await expect(page.getByRole("columnheader", { name: rep("payroll.colDays") })).toBeVisible();
    // La nómina lista a los empleados activos con sus días y horas; no muestra retardos ni faltas.
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /tarde|ausente/i })).toHaveCount(0);

    // Un rango personalizado sin datos queda vacío con guía.
    await page.getByRole("button", { name: rep("period.personalizado"), exact: true }).click();
    await page.getByLabel(rep("period.from"), { exact: true }).fill("2000-01-01");
    await page.getByLabel(rep("period.to"), { exact: true }).fill("2000-01-31");
    await tab(page, "tabIncome").click();
    await expect(page.getByText(rep("state.emptyTitle"))).toBeVisible();
  });

  test("[REP-011] un fallo de la API muestra el error con Reintentar y reintentar recupera @regresion", async ({ page }) => {
    await page.route("**/api/v1/reports/income**", (route) =>
      route.fulfill({ status: 500, json: { error: { status: 500, message: "Falla simulada", details: null } } }),
    );
    await page.goto("/es/reportes");
    await tab(page, "tabIncome").click();
    await expect(page.getByText(rep("state.errorTitle"))).toBeVisible();

    await page.unroute("**/api/v1/reports/income**");
    await page.getByRole("button", { name: rep("state.retry") }).click();
    await expect(page.getByText(rep("state.errorTitle"))).toHaveCount(0);
    await expect(page.getByText(rep("income.tableTitle")).or(page.getByText(rep("state.emptyTitle")))).toBeVisible();
  });

  test("[REP-011] el resumen y los ingresos muestran lo cobrado y el detalle de tickets @regresion", async ({ page }) => {
    await page.goto("/es/reportes");
    await expect(stat(page, rep("summary.collected")).first()).not.toContainText(/^\$0\b/);
    await tab(page, "tabIncome").click();
    await expect(page.getByRole("row").filter({ hasText: /T-\d+/ }).first()).toBeVisible();
  });
});

test("[FLU-09] tras cobrar una orden, el dashboard y los reportes suman el ingreso @regresion", async ({ browser, request }, info) => {
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
  await expect(stat(page, rep("summary.collected")).first()).toContainText("$100");
  await tab(page, "tabIncome").click();
  const ticket = page.getByRole("row").filter({ hasText: title });
  await expect(ticket).toHaveCount(1);
  await expect(ticket).toContainText(/T-\d+/);
  await expect(ticket).toContainText("$100");

  // 4. Un periodo sin cobros queda vacío (REP-007).
  await page.getByRole("button", { name: rep("period.personalizado"), exact: true }).click();
  await page.getByLabel(rep("period.from"), { exact: true }).fill("2000-01-01");
  await page.getByLabel(rep("period.to"), { exact: true }).fill("2000-01-31");
  await expect(page.getByText(rep("state.emptyTitle"))).toBeVisible();
  await owner.context.close();
});
