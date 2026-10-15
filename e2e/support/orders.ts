import { expect, type Page } from "@playwright/test";
import { t } from "./i18n";

export interface NewOrder {
  title: string;
  /** Texto de la opción del responsable (nombre del empleado). */
  assignee?: string;
  steps?: string[];
  /** Conceptos libres: descripción, cantidad y precio. */
  items?: Array<{ description: string; quantity: number; price: number }>;
  /** Pedido: productos del menú por nombre y cantidad (modo "order"). */
  products?: Array<{ name: string; quantity: number }>;
}

/** Id de la orden en una URL como /es/ordenes/12 o /es/mis-ordenes/12. */
export function orderIdFrom(url: string): string {
  const id = /\/ordenes\/(\d+)/.exec(url)?.[1];
  if (!id) throw new Error(`No hay id de orden en ${url}`);
  return id;
}

/**
 * Crea una orden desde /ordenes con el formulario (modo servicio o pedido) y espera a que se abra.
 * Devuelve su id. `mode` decide el botón de alta y si hay "Más detalles" con pasos.
 */
export async function createOrderViaUI(page: Page, order: NewOrder, mode: "service" | "order" = "service") {
  await page.goto("/es/ordenes");
  await page.getByRole("button", { name: t(`workOrders.labels.${mode}.new`) }).click();
  const form = page.getByRole("dialog");
  await form.getByPlaceholder(/Mesa 4|Instalación eléctrica/).fill(order.title);

  if (order.assignee) {
    const select = form.locator('select[name="employee_id"]');
    const option = select.locator("option", { hasText: order.assignee });
    await expect(option).toHaveCount(1);
    await select.selectOption((await option.getAttribute("value")) ?? "");
  }

  for (const [i, item] of (order.items ?? []).entries()) {
    await form.getByRole("button", { name: t("workOrders.form.addItem") }).click();
    const row = form.getByLabel(t("workOrders.concepts.freeDescription")).nth(i);
    await row.fill(item.description);
    await form.getByLabel(t("workOrders.concepts.quantity")).nth(i).fill(String(item.quantity));
    await form.getByLabel(t("workOrders.concepts.price")).nth(i).fill(String(item.price));
  }

  for (const [i, product] of (order.products ?? []).entries()) {
    await form.getByRole("button", { name: t("workOrders.form.addItem") }).click();
    const select = form.getByLabel(t("workOrders.concepts.product")).nth(i);
    const option = select.locator("option", { hasText: product.name });
    await expect(option.first()).toBeAttached();
    await select.selectOption((await option.first().getAttribute("value")) ?? "");
    await form.getByLabel(t("workOrders.concepts.quantity")).nth(i).fill(String(product.quantity));
  }

  if (mode === "service" && order.steps?.length) {
    await form.getByRole("button", { name: t("workOrders.form.moreDetails") }).click();
    for (const [i, step] of order.steps.entries()) {
      await form.getByRole("button", { name: t("workOrders.form.addStep") }).click();
      await form.getByLabel(`${t("workOrders.form.steps")} ${i + 1}`).fill(step);
    }
  }

  await form.getByRole("button", { name: t("workOrders.form.create") }).click();
  await expect(page.getByText(t("workOrders.createSuccess"))).toBeVisible();
  await page.waitForURL(/\/ordenes\/\d+$/);
  return orderIdFrom(page.url());
}
