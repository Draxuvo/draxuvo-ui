import { expect, test } from "@playwright/test";
import { t } from "../../support/i18n";
import { createOrderViaUI, orderIdFrom } from "../../support/orders";
import { storageStatePath } from "../../support/session";
import { uniquePrefix } from "../../support/data";

test("[FLU-04][ORD-021][ORD-022] orden de servicio de Volta: de crear a cobrar, con ticket @pr", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const prefix = uniquePrefix(testInfo.workerIndex);
  const title = `${prefix} cambio de apagadores`;
  const ctx = (role: "manager" | "staff" | "admin") =>
    browser.newContext({ storageState: storageStatePath(role, "volta.demo") });

  // 1. El gerente crea la orden, con responsable, dos pasos y un concepto de $100.
  const managerCtx = await ctx("manager");
  const manager = await managerCtx.newPage();
  const id = await createOrderViaUI(manager, {
    title,
    assignee: "Ana",
    steps: ["Medir", "Instalar"],
    items: [{ description: "Mano de obra", quantity: 1, price: 100 }],
  });
  await expect(manager.getByText(title).first()).toBeVisible();
  await expect(manager.getByText("$100.00").first()).toBeVisible();
  await managerCtx.close();

  // 2. El staff asignado la ejecuta: empieza, marca pasos, nota, y termina.
  const staffCtx = await ctx("staff");
  const staff = await staffCtx.newPage();
  await staff.goto(`/es/mis-ordenes/${id}`);
  await staff.getByRole("button", { name: t("workOrders.actions.start") }).click();
  await expect(staff.getByText(t("workOrders.started"))).toBeVisible();
  for (const step of ["Medir", "Instalar"]) {
    // El paso se guarda en la API y luego cambia: click y esperar, no .check().
    await staff.getByRole("checkbox", { name: t("workOrders.steps.check", { description: step }) }).click();
    await expect(staff.getByRole("checkbox", { name: t("workOrders.steps.uncheck", { description: step }) })).toBeChecked();
  }
  await staff.getByPlaceholder(t("workOrders.notesSection.placeholder")).fill("Listo en sitio");
  await staff.getByRole("button", { name: t("workOrders.notesSection.submit") }).click();
  await expect(staff.getByText("Listo en sitio")).toBeVisible();
  await staff.getByRole("button", { name: t("workOrders.actions.finish") }).click();
  await expect(staff.getByText(t("workOrders.finished"))).toBeVisible();
  await staffCtx.close();

  // 3. El admin cobra en efectivo y descarga el ticket.
  const adminCtx = await ctx("admin");
  const admin = await adminCtx.newPage();
  await admin.goto(`/es/ordenes/${id}`);
  await admin.getByRole("button", { name: t("workOrders.actions.charge") }).click();
  await expect(admin.getByRole("radio", { name: t("workOrders.charge.methods.cash") })).toBeChecked();
  await admin.getByRole("spinbutton", { name: t("workOrders.charge.received") }).fill("150");
  await expect(admin.getByText(/Cambio/)).toContainText("50.00");
  await admin.getByRole("button", { name: t("workOrders.charge.confirm") }).click();
  await expect(admin.getByText(t("workOrders.charge.success"))).toBeVisible();
  const [download] = await Promise.all([
    admin.waitForEvent("download"),
    admin.getByRole("button", { name: t("workOrders.charge.downloadPdf") }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^ticket-T-.*\.pdf$/);
  await admin.getByRole("button", { name: t("workOrders.charge.done") }).click();

  // 4. Estado final: cobrada, con ticket y toda la historia en orden.
  await expect(admin.getByText(t("workOrders.statuses.paid")).first()).toBeVisible();
  await expect(admin.getByRole("button", { name: t("workOrders.actions.viewTicket") })).toBeVisible();
  expect(orderIdFrom(admin.url())).toBe(id);
  const history = admin.getByRole("region", { name: t("workOrders.history.title") });
  await expect(history.getByText(/creó la orden/)).toBeVisible();
  await expect(history.getByText(/empezó la orden/)).toBeVisible();
  await expect(history.getByText(/agregó una nota/)).toBeVisible();
  await expect(history.getByText(/terminó la orden/)).toBeVisible();
  await expect(history.getByText(/cobró la orden\. Folio T-\d+, Efectivo/)).toBeVisible();
  await adminCtx.close();
});
