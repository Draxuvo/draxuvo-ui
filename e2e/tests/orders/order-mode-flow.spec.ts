import { expect, test } from "@playwright/test";
import { uniquePrefix } from "../../support/data";
import { t } from "../../support/i18n";
import { API_URL, storageStatePath } from "../../support/session";

test.describe("Sazón (modo pedido, plan Empresa)", () => {
  test.use({ storageState: storageStatePath("manager", "sazon.demo") });

  test("[FLU-05] pedido con productos del menú, cobro y ticket por WhatsApp @pr", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const table = `${uniquePrefix(testInfo.workerIndex)} Mesa 8`;

    // [ORD-003] El pedido usa productos del menú y no tiene pasos. Con mesas dadas de alta, "Nuevo pedido" abre
    // la pantalla de cuentas (spec 018); la orden de trabajo en modo pedido se arma por API y se cobra desde su detalle.
    const { token, companyId } = await page.goto("/es/inicio").then(() =>
      page.evaluate(() => ({ token: localStorage.getItem("auth_token") ?? "", companyId: localStorage.getItem("selected_company_id") ?? "" })),
    );
    const headers = { Authorization: `Bearer ${token}`, "X-Company-Id": companyId };
    const menu = await (await page.request.get(`${API_URL}/api/v1/products/menu`, { headers })).json();
    const products = menu.menu.flatMap((g: { items: { id: number; sold_out?: boolean }[] }) => g.items).filter((p: { sold_out?: boolean }) => !p.sold_out);
    const created = await page.request.post(`${API_URL}/api/v1/work_orders`, {
      headers,
      data: { work_order: { title: table }, items: products.slice(0, 2).map((p: { id: number }) => ({ product_id: p.id, quantity: 2 })) },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id as number;
    await page.goto(`/es/ordenes/${id}`);
    await expect(page.getByText(table).first()).toBeVisible();
    await expect(page.getByText(t("workOrders.steps.title"), { exact: true })).toHaveCount(0);

    // Un pedido abierto se termina y se cobra.
    await page.getByRole("button", { name: t("workOrders.actions.finish") }).click();
    await expect(page.getByText(t("workOrders.finished"))).toBeVisible();
    await page.getByRole("button", { name: t("workOrders.actions.charge") }).click();
    await page.getByRole("spinbutton", { name: t("workOrders.charge.received") }).fill("1000");
    await page.getByRole("button", { name: t("workOrders.charge.confirm") }).click();
    await expect(page.getByText(/Cobrado con folio T-\d+/)).toBeVisible();

    // WhatsApp está simulado: nunca se llama al servicio real.
    await page.route("**/api/v1/tickets/*/send_whatsapp", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );
    await page.getByLabel(t("workOrders.charge.phone")).fill("5219876543210");
    const [request] = await Promise.all([
      page.waitForRequest("**/api/v1/tickets/*/send_whatsapp"),
      page.getByRole("button", { name: t("workOrders.charge.sendWhatsapp") }).click(),
    ]);
    expect(request.postDataJSON()).toMatchObject({ phone: "5219876543210" });
    await page.getByRole("button", { name: t("workOrders.charge.done") }).click();
    await expect(page.getByText(t("workOrders.statuses.paid")).first()).toBeVisible();
    expect(id).toBeTruthy();
  });
});

test.describe("plan sin el módulo de órdenes", () => {
  test.use({ storageState: storageStatePath("owner", "donchuy.demo") });

  test("[ORD-018] Básico ve que el módulo no está en su plan @pr", async ({ page }) => {
    await page.goto("/es/ordenes");
    await expect(page.getByText(t("subscription.moduleLocked"))).toBeVisible();
    await expect(page.getByRole("link", { name: t("subscription.upgradePlan") })).toBeVisible();
  });
});
