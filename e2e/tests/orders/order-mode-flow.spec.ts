import { expect, test } from "@playwright/test";
import { uniquePrefix } from "../../support/data";
import { t } from "../../support/i18n";
import { createOrderViaUI } from "../../support/orders";
import { storageStatePath } from "../../support/session";

test.describe("Sazón (modo pedido, plan Empresa)", () => {
  test.use({ storageState: storageStatePath("manager", "sazon.demo") });

  test("[FLU-05] pedido con productos del menú, cobro y ticket por WhatsApp @pr", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const table = `${uniquePrefix(testInfo.workerIndex)} Mesa 8`;

    // [ORD-003] El pedido pide "Mesa o cliente", no pasos, y usa productos del menú.
    const id = await createOrderViaUI(
      page,
      { title: table, products: [{ name: "Café", quantity: 2 }, { name: "Refresco", quantity: 2 }] },
      "order",
    );
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
