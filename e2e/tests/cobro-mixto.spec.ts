import { expect, test, type Page } from "@playwright/test";
import { uniquePrefix } from "../support/data";
import { t } from "../support/i18n";
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
  await page.getByRole("button", { name: wo("staff.newOrder") }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder(/Mesa 4/).fill("Mostrador");
  await sheet.getByRole("button", { name: wo("form.addItem") }).click();
  const product = sheet.getByLabel(wo("concepts.product"));
  await expect(product.locator("option").nth(1)).toBeAttached();
  await product.selectOption({ index: 1 });
  await sheet.getByRole("button", { name: wo("form.create") }).click();
  await expect(page).toHaveURL(/\/es\/mis-ordenes\/\d+$/);
  const id = /\/mis-ordenes\/(\d+)$/.exec(page.url())![1];

  // 3. La termina (por API, para no depender de los botones del modo pedido) y lee su total.
  const headers = await apiHeaders(page);
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
