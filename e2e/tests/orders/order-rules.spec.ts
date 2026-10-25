import { expect, test, type Browser, type Page } from "@playwright/test";
import { knownFailure } from "../../support/known-failure";
import { uniquePrefix } from "../../support/data";
import { t } from "../../support/i18n";
import { createOrderViaUI } from "../../support/orders";
import { storageStatePath } from "../../support/session";

const action = (page: Page, key: string) => page.getByRole("button", { name: t(`workOrders.actions.${key}`) });

async function as(browser: Browser, role: "admin" | "owner", id: string) {
  const context = await browser.newContext({ storageState: storageStatePath(role, "volta.demo") });
  const page = await context.newPage();
  await page.goto(`/es/ordenes/${id}`);
  return { context, page };
}

async function newOrder(browser: Browser, testIndex: number, label: string) {
  const context = await browser.newContext({ storageState: storageStatePath("admin", "volta.demo") });
  const page = await context.newPage();
  const title = `${uniquePrefix(testIndex)} ${label}`;
  const id = await createOrderViaUI(page, {
    title,
    items: [{ description: "Mano de obra", quantity: 1, price: 100 }],
  });
  return { context, page, id, title };
}

test("[ORD-023] el administrador cancela con motivo y la orden queda bloqueada @regresion", async ({ browser }, info) => {
  test.setTimeout(90_000);
  const { context, page } = await newOrder(browser, info.workerIndex, "cancelar");

  await expect(action(page, "edit")).toBeVisible();
  await expect(action(page, "cancel")).toBeVisible();

  await action(page, "cancel").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(t("workOrders.actions.cancelDesc"))).toBeVisible();
  // Sin motivo el botón no se puede pulsar; con motivo, sí.
  await expect(dialog.getByRole("button", { name: t("workOrders.actions.cancelConfirm") })).toBeDisabled();

  await dialog.getByLabel(t("workOrders.actions.reasonLabel")).fill("Cliente cambió de opinión");
  await dialog.getByRole("button", { name: t("workOrders.actions.cancelConfirm") }).click();
  await expect(page.getByText(t("workOrders.cancelledSuccess"))).toBeVisible();
  await expect(page.getByText(t("workOrders.actions.cancelledNote"))).toBeVisible();
  await expect(action(page, "edit")).toHaveCount(0);
  await context.close();
});

test("[ORD-012] una orden cobrada no se cambia; el admin anula el cobro @pr", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const { context, page, id } = await newOrder(browser, info.workerIndex, "cobrada");

  await action(page, "finish").click();
  await expect(page.getByText(t("workOrders.finished"))).toBeVisible();
  await action(page, "charge").click();
  await page.getByRole("spinbutton", { name: t("workOrders.charge.received") }).fill("100");
  await page.getByRole("button", { name: t("workOrders.charge.confirm") }).click();
  await expect(page.getByText(/Cobrado con folio T-\d+/)).toBeVisible();
  await page.getByRole("button", { name: t("workOrders.charge.done") }).click();

  // Cobrada: se ve el ticket y ya no se edita, cancela ni cobra.
  await expect(page.getByText(t("workOrders.statuses.paid")).first()).toBeVisible();
  await expect(action(page, "viewTicket")).toBeVisible();
  for (const key of ["edit", "cancel", "charge"]) {
    await expect(action(page, key), key).toHaveCount(0);
  }
  await context.close();

  // El admin anula el cobro con motivo y la orden vuelve a Terminada.
  const admin = await as(browser, "admin", id);
  await action(admin.page, "voidCharge").click();
  const dialog = admin.page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: t("workOrders.actions.voidConfirm") })).toBeDisabled();
  await dialog.getByLabel(t("workOrders.actions.reasonLabel")).fill("Error de captura");
  await dialog.getByRole("button", { name: t("workOrders.actions.voidConfirm") }).click();
  await expect(admin.page.getByText(t("workOrders.voidedSuccess"))).toBeVisible();
  await expect(admin.page.getByText(t("workOrders.statuses.done")).first()).toBeVisible();
  await expect(action(admin.page, "charge")).toBeVisible();
  await admin.context.close();
});

test("[ORD-007] una acción que ya no aplica recarga la orden sin dañarla @regresion", async ({ browser }, info) => {
  knownFailure("H-21");
  test.setTimeout(120_000);
  const creator = await newOrder(browser, info.workerIndex, "desfasada");

  // Otra persona la empieza mientras quien la creó la tiene abierta.
  const admin = await as(browser, "admin", creator.id);
  await action(admin.page, "start").click();
  await expect(admin.page.getByText(t("workOrders.started"))).toBeVisible();
  await admin.context.close();

  await action(creator.page, "start").click();
  await expect(creator.page.getByText(t("workOrders.errors.invalid_transition"))).toBeVisible();
  await expect(creator.page.getByText(t("workOrders.statuses.in_progress")).first()).toBeVisible();
  await expect(action(creator.page, "start")).toHaveCount(0);
  await creator.context.close();
});

test("[ORD-023] el admin elimina una orden abierta tras confirmar @regresion", async ({ browser }, info) => {
  test.setTimeout(90_000);
  const { context, id, title } = await newOrder(browser, info.workerIndex, "eliminar");
  await context.close();

  const admin = await as(browser, "admin", id);
  await action(admin.page, "delete").click();
  await expect(admin.page.getByText(t("workOrders.actions.deleteConfirm", { title }))).toBeVisible();
  await admin.page.getByRole("dialog").getByRole("button", { name: t("workOrders.actions.delete") }).click();
  await expect(admin.page.getByText(t("workOrders.deleteSuccess"))).toBeVisible();
  await expect(admin.page).toHaveURL(/\/es\/ordenes$/);
  await admin.context.close();
});
