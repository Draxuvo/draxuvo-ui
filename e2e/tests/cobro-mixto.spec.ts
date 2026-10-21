import { expect, test, type Page } from "@playwright/test";
import { createCompany, uniquePrefix } from "../support/data";
import { t } from "../support/i18n";
import { setDisabledModules } from "../support/modules";
import { createOrderViaUI } from "../support/orders";
import { API_URL, storageStatePath } from "../support/session";

// Spec 015: el admin da de alta una terminal, el operador crea su orden y la cobra con tarjeta + efectivo.
// Café Aroma (aroma.demo) está en modo pedido.
const wo = (key: string, values?: Record<string, string | number>) => t(`workOrders.${key}`, values);

async function apiHeaders(page: Page) {
  const { token, companyId } = await page.evaluate(() => ({
    token: localStorage.getItem("auth_token") ?? "",
    companyId: localStorage.getItem("selected_company_id") ?? "",
  }));
  return { Authorization: `Bearer ${token}`, "X-Company-Id": companyId };
}

test("[COB-001] el operador crea su orden y la cobra con tarjeta en una terminal y efectivo @pr", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const terminal = `${uniquePrefix(info.workerIndex)} Clip`;

  // 1. El admin da de alta la terminal.
  const adminContext = await browser.newContext({ storageState: storageStatePath("admin", "aroma.demo") });
  const admin = await adminContext.newPage();
  await admin.goto("/es/terminales");
  await admin.getByRole("button", { name: t("terminals.new") }).click();
  const form = admin.getByRole("dialog");
  await form.getByLabel(t("terminals.name")).fill(terminal);
  await form.getByLabel(t("terminals.provider")).selectOption("clip");
  await form.getByRole("button", { name: t("terminals.save") }).click();
  await expect(admin.getByText(terminal)).toBeVisible();
  await adminContext.close();

  // 2. El operador crea su orden con un producto del catálogo.
  const context = await browser.newContext({ storageState: storageStatePath("staff", "aroma.demo") });
  const page = await context.newPage();
  await page.goto("/es/mis-ordenes");
  // Aroma está en modo pedido y sin mesas: "Nueva orden" abre la pantalla visual (spec 018).
  await page.getByRole("button", { name: wo("staff.newOrder") }).click();
  await expect(page).toHaveURL(/\/es\/pedido$/);
  const title = `${uniquePrefix(info.workerIndex)} Mostrador`;
  await page.getByRole("button", { name: t("takeOrder.newOrder"), exact: true }).click();
  await page.getByLabel(t("takeOrder.newNameOrderPlaceholder")).fill(title);
  await page.getByRole("button", { name: t("takeOrder.newCreate"), exact: true }).click();
  const card = page.locator('button[aria-label$="agregar"]:not([disabled])').first();
  await card.click();
  await expect(card.locator("span[aria-label$='en la orden']")).toBeVisible();
  const headers = await apiHeaders(page);
  const found = await (await page.request.get(`${API_URL}/api/v1/work_orders`, { headers, params: { search: title } })).json();
  const id = String(found.results[0].id);
  await page.goto(`/es/mis-ordenes/${id}`);

  // 3. La termina (por API, para no depender de los botones del modo pedido) y lee su total.
  expect((await page.request.post(`${API_URL}/api/v1/work_orders/${id}/finish`, { headers })).ok()).toBe(true);
  const total = Number((await (await page.request.get(`${API_URL}/api/v1/work_orders/${id}`, { headers })).json()).total);
  expect(total).toBeGreaterThan(1);
  await page.reload();

  // 4. Cobra con tarjeta (todo menos $1) en la terminal nueva y $1 en efectivo, recibiendo $20.
  await page.getByRole("button", { name: wo("actions.charge"), exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText(wo("charge.methods.card"), { exact: true }).click();
  await dialog.getByLabel(wo("charge.terminal")).selectOption({ label: terminal });
  await dialog.getByLabel(wo("charge.authorization")).fill("123456");
  await dialog.getByRole("button", { name: wo("charge.addPayment") }).click();
  await dialog.getByLabel(wo("charge.amount")).fill(String(total - 1));
  await dialog.getByLabel(wo("charge.received")).fill("20");
  await expect(dialog.getByText(`${wo("charge.change")}: $19.00`)).toBeVisible();
  await dialog.getByRole("button", { name: wo("charge.confirm") }).click();
  await expect(page.getByText(/Cobrado con folio T-\d+/)).toBeVisible();

  // 5. El ticket guarda los dos pagos, la terminal y el método mixto.
  const charged = await (await page.request.get(`${API_URL}/api/v1/work_orders/${id}`, { headers })).json();
  expect(charged.ticket.payment_method).toBe("mixed");
  expect(charged.ticket.payments.map((p: { method: string }) => p.method)).toEqual(["card", "cash"]);
  expect(charged.ticket.payments[0].terminal.name).toBe(terminal);
  expect(charged.ticket.payments[0].authorization_code).toBe("123456");
  await context.close();
});

// Spec 030: Terminales es un módulo de Pro y Empresa.
test.describe("dueño de Don Chuy (plan Básico)", () => {
  test.use({ storageState: storageStatePath("owner", "donchuy.demo") });

  test("[COB-002] sin el módulo Terminales no hay menú, la página muestra el bloqueo y la API responde 403 @regresion", async ({ page }) => {
    await page.goto("/es/inicio");
    await expect(page.getByRole("navigation", { name: t("nav.mainNav") }).getByRole("link", { name: t("nav.terminals") })).toHaveCount(0);

    await page.goto("/es/terminales");
    await expect(page.getByText(t("subscription.moduleLocked"))).toBeVisible();

    const res = await page.request.get(`${API_URL}/api/v1/payment_terminals`, { headers: await apiHeaders(page) });
    expect(res.status()).toBe(403);
    expect((await res.json()).error.details).toMatchObject({ code: "module_not_in_plan", module: "terminals" });
  });
});

test("[COB-003] con Terminales apagado por el super admin el cobro con tarjeta se guarda sin terminal y sin avisos de error @regresion", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(company.email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(company.password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
  await expect(page).toHaveURL(/\/es\/inicio$/);
  const companyId = await page.evaluate(() => localStorage.getItem("selected_company_id") ?? "");

  // El super admin apaga el módulo y el menú pierde la entrada.
  await setDisabledModules(request, companyId, ["terminals"]);
  await page.reload();
  await expect(page.getByRole("navigation", { name: t("nav.mainNav") }).getByRole("link", { name: t("nav.terminals") })).toHaveCount(0);

  // Crea una orden, la termina y la cobra con tarjeta: no hay selector de terminal ni avisos de error.
  const title = `${uniquePrefix(info.workerIndex)} cobro tarjeta`;
  await createOrderViaUI(page, { title, items: [{ description: "Mano de obra", quantity: 1, price: 100 }] });
  const action = (key: string) => page.getByRole("button", { name: wo(`actions.${key}`) });
  await action("start").click();
  await expect(page.getByText(wo("started"))).toBeVisible();
  await action("finish").click();
  await expect(page.getByText(wo("finished"))).toBeVisible();
  await action("charge").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText(wo("charge.methods.card"), { exact: true }).click();
  await expect(dialog.getByLabel(wo("charge.terminal"))).toHaveCount(0);
  await dialog.getByRole("button", { name: wo("charge.confirm") }).click();
  await expect(page.getByText(/Cobrado con folio T-\d+/)).toBeVisible();

  const headers = await apiHeaders(page);
  const found = await (await page.request.get(`${API_URL}/api/v1/work_orders`, { headers, params: { search: title } })).json();
  const charged = await (await page.request.get(`${API_URL}/api/v1/work_orders/${found.results[0].id}`, { headers })).json();
  expect(charged.ticket.payments[0].method).toBe("card");
  expect(charged.ticket.payments[0].terminal).toBeNull();
  await context.close();
});
