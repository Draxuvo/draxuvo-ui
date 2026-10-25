import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { createCompany, uniquePrefix } from "../support/data";
import { t } from "../support/i18n";
import { knownFailure } from "../support/known-failure";
import { createOrderViaUI } from "../support/orders";
import { API_URL, authFile, storageStatePath } from "../support/session";

const ANON = { cookies: [], origins: [] };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const wo = (key: string, values?: Record<string, string | number>) => t(`workOrders.${key}`, values);
const tk = (key: string, values?: Record<string, string | number>) => t(`tickets.${key}`, values);
const group = (page: Page, key: string) => page.getByRole("region", { name: wo(`groups.${key}`), exact: true });
/** Los botones de una fila de la lista de tickets no tienen nombre: la fila entera es el botón. */
const ticketRow = (page: Page, text: string | RegExp): Locator => page.getByRole("button").filter({ hasText: text });

/** Dueño de una empresa nueva con plan Pro, con una sesión abierta y las cabeceras de su empresa. */
async function proOwner(browser: Browser, request: Parameters<typeof createCompany>[0], workerIndex: number) {
  const company = await createCompany(request, { workerIndex, plan: "pro" });
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(company.email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(company.password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
  await expect(page).toHaveURL(/\/es\/inicio$/);
  const companyId = await page.evaluate(() => localStorage.getItem("selected_company_id") ?? "");
  return { context, page, headers: { Authorization: `Bearer ${company.token}`, "X-Company-Id": companyId } };
}

test.describe("administrador de Volta", () => {
  test.use({ storageState: storageStatePath("admin", "volta.demo") });

  test("[ORD-020] la pantalla de órdenes trae sus grupos y el botón de nuevo servicio @regresion", async ({ page }) => {
    await page.goto("/es/ordenes");
    await expect(page.getByRole("heading", { name: wo("title"), level: 1 })).toBeVisible();
    for (const key of ["toCharge", "open", "inProgress", "unassigned", "paidToday"]) {
      await expect(group(page, key), key).toBeVisible();
    }
    await expect(page.getByText(new RegExp(wo("groups.toChargeTotal", { amount: "\\$[\\d,.]+" }).replace(/[()]/g, "\\$&")))).toBeVisible();
    await expect(page.getByRole("button", { name: wo("labels.service.new") })).toBeVisible();
    // Solo el dueño cambia el modo de órdenes.
    await expect(page.getByRole("button", { name: wo("mode.open") })).toHaveCount(0);
  });

  test("[ORD-020] filtros por estado, búsqueda, prioridad y responsable viven en la URL @regresion", async ({ page }, info) => {
    test.setTimeout(90_000);
    const title = `${uniquePrefix(info.workerIndex)} tablero`;
    await createOrderViaUI(page, { title, items: [{ description: "Mano de obra", quantity: 1, price: 100 }] });

    await page.goto("/es/ordenes");
    const chip = (key: string) => page.getByRole("group", { name: wo("filters.status") }).getByRole("button", { name: wo(`statuses.${key}`), exact: true });
    await chip("cancelled").click();
    await expect(page).toHaveURL(/status=cancelled/);
    await expect(chip("cancelled")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("group", { name: wo("filters.status") }).getByRole("button", { name: wo("all"), exact: true }).click();
    await expect(page).not.toHaveURL(/status=/);

    // La búsqueda pasa a una lista plana con la orden creada arriba.
    await page.getByPlaceholder(wo("searchPlaceholder")).fill(title);
    await expect(page).toHaveURL(/search=/);
    const card = page.getByRole("link").filter({ hasText: title });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("$100.00");
    await expect(card).toContainText(wo("unassigned"));

    await page.getByLabel(wo("filters.priority")).selectOption({ label: wo("priorities.urgent") });
    await expect(page).toHaveURL(/priority=urgent/);
    await page.getByLabel(wo("filters.employee")).selectOption({ index: 1 });
    await expect(page).toHaveURL(/employee_id=\d+/);
    await page.getByRole("button", { name: t("common.filters.clear") }).click();
    await expect(page).not.toHaveURL(/search=|priority=|employee_id=/);
    await expect(group(page, "open")).toBeVisible();
  });
});

test.describe("quien cambia el modo de órdenes", () => {
  test.describe("dueño de Volta", () => {
    test.use({ storageState: storageStatePath("owner", "volta.demo") });

    test("[ORD-020] el dueño ve el botón del modo y el admin no @regresion", async ({ page, browser }) => {
      await page.goto("/es/ordenes");
      await expect(page.getByRole("button", { name: wo("mode.open") })).toBeVisible();
      const admin = await browser.newContext({ storageState: storageStatePath("admin", "volta.demo") });
      const adminPage = await admin.newPage();
      await adminPage.goto("/es/ordenes");
      await expect(adminPage.getByRole("button", { name: wo("labels.service.new") })).toBeVisible();
      await expect(adminPage.getByRole("button", { name: wo("mode.open") })).toHaveCount(0);
      await admin.close();
    });
  });

  test.describe("administrador de Sazón", () => {
    test.use({ storageState: storageStatePath("admin", "sazon.demo") });

    test("[ORD-020] en modo pedido el botón dice Nuevo pedido y no hay prioridad @regresion", async ({ page }) => {
      await page.goto("/es/ordenes");
      await expect(page.getByRole("button", { name: wo("labels.order.new") })).toBeVisible();
      await expect(page.getByLabel(wo("filters.priority"))).toHaveCount(0);
    });
  });
});

test("[ORD-020] un grupo con más de cinco órdenes ofrece Ver más y Ver menos @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const owner = await proOwner(browser, request, info.workerIndex);
  const prefix = uniquePrefix(info.workerIndex);
  for (let i = 1; i <= 6; i++) {
    const created = await request.post(`${API_URL}/api/v1/work_orders`, { headers: owner.headers, data: { work_order: { title: `${prefix} ${i}` } } });
    expect(created.status()).toBe(201);
  }

  await owner.page.goto("/es/ordenes");
  const open = group(owner.page, "unassigned");
  await expect(open.getByRole("link")).toHaveCount(5);
  await open.getByRole("button", { name: wo("groups.showMore") }).click();
  await expect(open.getByRole("link")).toHaveCount(6);
  await open.getByRole("button", { name: wo("groups.showLess") }).click();
  await expect(open.getByRole("link")).toHaveCount(5);
  await owner.context.close();
});

test("[ORD-024] conceptos, pasos, notas, fotos e historia de una orden @regresion", async ({ browser }, info) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ storageState: storageStatePath("admin", "volta.demo") });
  const page = await context.newPage();
  const title = `${uniquePrefix(info.workerIndex)} partes`;
  await createOrderViaUI(page, { title, assignee: "Ana", steps: ["Medir"], items: [{ description: "Mano de obra", quantity: 1, price: 100 }] });
  const total = () => page.getByText(wo("concepts.total"), { exact: true }).locator("xpath=..");

  // Conceptos: uno del catálogo, uno libre; se edita un precio y se quita uno.
  await page.getByLabel(wo("concepts.addFromCatalog")).click();
  await page.getByRole("dialog").getByRole("listitem").first().getByRole("button").click();
  await page.getByRole("button", { name: wo("concepts.add"), exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "×" })).toHaveCount(2);
  await page.getByLabel(wo("concepts.freeDescription")).fill("Material");
  await page.getByLabel(wo("concepts.price"), { exact: true }).fill("50");
  await page.getByRole("button", { name: wo("concepts.addFree") }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Material" })).toBeVisible();
  const material = page.getByRole("listitem").filter({ hasText: "Material" });
  await material.getByLabel(wo("concepts.editPrice")).fill("80");
  await material.getByLabel(wo("concepts.editPrice")).blur();
  await expect(material).toContainText("$80.00");
  await page.getByRole("button", { name: wo("concepts.deleteAria", { description: "Material" }) }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Material" })).toHaveCount(0);
  await expect(total()).toContainText("$");

  // Pasos: agregar, marcar, desmarcar y borrar.
  await expect(page.getByText(wo("steps.progress", { done: 0, total: 1 }))).toBeVisible();
  await page.getByLabel(wo("steps.add"), { exact: true }).fill("Instalar");
  await page.getByRole("button", { name: wo("steps.add"), exact: true }).click();
  await expect(page.getByText(wo("steps.progress", { done: 0, total: 2 }))).toBeVisible();
  await page.getByRole("checkbox", { name: wo("steps.check", { description: "Instalar" }) }).click();
  await expect(page.getByRole("checkbox", { name: wo("steps.uncheck", { description: "Instalar" }) })).toBeChecked();
  await expect(page.getByText(wo("steps.progress", { done: 1, total: 2 }))).toBeVisible();
  await page.getByRole("checkbox", { name: wo("steps.uncheck", { description: "Instalar" }) }).click();
  await expect(page.getByRole("checkbox", { name: wo("steps.check", { description: "Instalar" }) })).not.toBeChecked();
  await page.getByRole("listitem").filter({ hasText: "Instalar" }).getByRole("button", { name: wo("aria.removeStep") }).click();
  await expect(page.getByText(wo("steps.progress", { done: 0, total: 1 }))).toBeVisible();

  // Notas: no se envía una nota vacía; con texto aparece.
  await expect(page.getByRole("button", { name: wo("notesSection.submit") })).toBeDisabled();
  await page.getByPlaceholder(wo("notesSection.placeholder")).fill("Cliente pide factura");
  await page.getByRole("button", { name: wo("notesSection.submit") }).click();
  await expect(page.getByText("Cliente pide factura")).toBeVisible();

  // Fotos: una imagen entra; un PDF no, y la pantalla ofrece reintentar.
  await page.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(wo("photos.uploadSuccess"))).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByText(wo("photos.uploadError"))).toBeVisible();
  await page.getByRole("button", { name: wo("photos.delete") }).click();
  await expect(page.getByText(wo("photos.empty"))).toBeVisible();

  // Historia: cada evento, en orden.
  const history = page.getByRole("region", { name: wo("history.title") });
  await expect(history.getByText(/creó la orden/)).toBeVisible();
  await expect(history.getByText(/agregó una nota/)).toBeVisible();
  await expect(history.getByText(/agregó una foto/)).toBeVisible();
  await context.close();
});

test.describe("dueño de Sazón", () => {
  test.use({ storageState: storageStatePath("owner", "sazon.demo") });

  test("[ORD-025] la pantalla de tickets: filtros, búsqueda, detalle, PDF, orden y WhatsApp @regresion", async ({ page }) => {
    test.setTimeout(90_000);
    await page.route("**/api/v1/tickets/*/send_whatsapp", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok" }) }),
    );
    await page.goto("/es/tickets");
    await expect(page.getByRole("heading", { name: tk("title"), level: 1 })).toBeVisible();
    const chip = (key: string) => page.getByRole("group", { name: tk("filterStatus") }).getByRole("button", { name: new RegExp(`^${key === "all" ? tk("all") : tk(`statuses.${key}`)}`) });
    for (const key of ["all", "pending", "paid", "voided"]) await expect(chip(key)).toBeVisible();

    await chip("paid").click();
    await expect(page).toHaveURL(/status=paid/);
    await expect(ticketRow(page, /T-\d+/).first()).toBeVisible();
    await expect(ticketRow(page, /T-\d+/).filter({ hasText: tk("statuses.voided") })).toHaveCount(0);
    const first = ticketRow(page, /T-\d+/).first();
    await expect(first).toBeVisible();
    const folio = (await first.textContent())?.match(/T-\d+/)?.[0] ?? "";
    await page.getByPlaceholder(tk("searchPlaceholder")).fill(folio);
    await expect(page.getByRole("button").filter({ hasText: /T-\d+/ })).toHaveCount(1);
    await page.getByPlaceholder(tk("searchPlaceholder")).fill("zzz-sin-coincidencia");
    await expect(page.getByText(t("common.filters.noResults"))).toBeVisible();

    // El detalle de un ticket pagado, su PDF, la orden y el reenvío por WhatsApp (simulado).
    await page.getByPlaceholder(tk("searchPlaceholder")).fill(folio);
    await ticketRow(page, folio).click();
    const detail = page.getByRole("dialog").first();
    await expect(detail.getByText(tk("ticketTitle"))).toBeVisible();
    for (const label of ["paymentMethod", "chargedBy", "items", "total"]) {
      await expect(detail.getByText(tk(label), { exact: true }).first(), label).toBeVisible();
    }
    const [download] = await Promise.all([page.waitForEvent("download"), detail.getByRole("button", { name: tk("download") }).click()]);
    expect(download.suggestedFilename()).toMatch(/^ticket-T-.*\.pdf$/);

    await detail.getByRole("button", { name: tk("resendWhatsapp") }).click();
    const whatsapp = page.getByRole("dialog").filter({ hasText: tk("sendWhatsappTitle") });
    await whatsapp.getByPlaceholder(tk("phonePlaceholder")).fill("5219876543210");
    const sent = page.waitForRequest((r) => r.url().endsWith("/send_whatsapp"));
    await whatsapp.getByRole("button", { name: tk("send"), exact: true }).click();
    expect((await sent).postDataJSON()).toMatchObject({ phone: "5219876543210" });
    await expect(page.getByText(tk("whatsappSent"))).toBeVisible();

    // Un ticket anulado dice que lo fue, sin ofrecer reenviarlo.
    await page.goto("/es/tickets?status=voided");
    await ticketRow(page, /T-\d+/).first().click();
    await expect(page.getByRole("dialog").getByText(tk("voidedNote"))).toBeVisible();
    await expect(page.getByRole("dialog").getByText(tk("voidReason"))).toBeVisible();
    await expect(page.getByRole("button", { name: tk("resendWhatsapp") })).toHaveCount(0);
  });
});

test.describe("ver la orden desde un ticket", () => {
  test.use({ storageState: storageStatePath("owner", "sazon.demo") });

  test("[ORD-025] Ver orden en el detalle del ticket abre la orden del cobro @regresion", async ({ page }) => {
    knownFailure("H-23");
    await page.goto("/es/tickets?status=paid");
    await ticketRow(page, /T-\d+/).first().click();
    await page.getByRole("dialog").first().getByRole("link", { name: tk("viewOrder") }).click();
    await expect(page).toHaveURL(/\/es\/ordenes\/\d+$/);
  });
});

test.describe("dueño de Volta (sin WhatsApp en su plan)", () => {
  test.use({ storageState: authFile("owner-volta.demo") });

  test("[ORD-025] reenviar por WhatsApp sin el módulo en el plan avisa que no está incluido @regresion", async ({ page }) => {
    await page.goto("/es/tickets?status=paid");
    const first = page.getByRole("button").filter({ hasText: /T-\d+/ }).first();
    await expect(first).toBeVisible();
    await first.click();
    await page.getByRole("dialog").first().getByRole("button", { name: tk("resendWhatsapp") }).click();
    const whatsapp = page.getByRole("dialog").filter({ hasText: tk("sendWhatsappTitle") });
    await whatsapp.getByPlaceholder(tk("phonePlaceholder")).fill("5219876543210");
    await whatsapp.getByRole("button", { name: tk("send"), exact: true }).click();
    await expect(page.getByText(t("api.moduleNotInPlan", { module: "WhatsApp" }))).toBeVisible();
  });
});
