import { expect, test, type Page } from "@playwright/test";
import { t } from "../support/i18n";
import { storageStatePath } from "../support/session";

// Spec 018: la pantalla visual para tomar pedido. Restaurante Sazón tiene mesas, así que trabaja con cuentas.
/** Abre la primera mesa libre en Tomar pedido y devuelve su nombre. */
async function openFreeTable(page: Page): Promise<string> {
  await page.goto("/es/pedido");
  const free = page.getByRole("button", { name: /, Libre$/ }).first();
  await expect(free).toBeVisible();
  const name = tableNameOf(await free.getAttribute("aria-label"));
  await free.click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  return name;
}

/** El aria-label de una pieza del plano es "Mesa 3, Libre": el nombre de la mesa es lo que va entre medio. */
function tableNameOf(label: string | null): string {
  return (label ?? "").replace(/, Libre$/, "").replace(/^Mesa /, "");
}

/** Pieza del plano de una mesa en un estado, p. ej. `tile(page, "3", "Libre")`. */
function tile(page: Page, tableName: string, state: string) {
  return page.getByRole("button", { name: new RegExp(`^Mesa ${tableName}, ${state}`) });
}

const tk = (key: string, values?: Record<string, string | number>) => t(`takeOrder.${key}`, values);

test.describe("Sazón (mesas)", () => {
  test.use({ storageState: storageStatePath("admin", "sazon.demo") });

  test("[PED-001] elegir una mesa, armar la orden con tarjetas, mandar y cobrar @pr", async ({ page }) => {
    test.setTimeout(120_000);
    // Tomar pedido vive dentro de Restaurante (spec 019): menú lateral → Restaurante → botón.
    await page.goto("/es/inicio");
    await page.getByRole("link", { name: t("nav.restaurant"), exact: true }).first().click();
    await page.getByRole("link", { name: tk("title"), exact: true }).click();
    await expect(page).toHaveURL(/\/es\/pedido\?from=restaurante$/);

    // Plano: una mesa libre con su estado en texto. Al tocarla se abre su cuenta en la misma pantalla.
    const free = page.getByRole("button", { name: /, Libre$/ }).first();
    await expect(free).toBeVisible();
    const tableName = tableNameOf(await free.getAttribute("aria-label"));
    await free.click();
    await expect(page.getByRole("heading", { name: tableName, exact: true })).toBeVisible();
    await expect(page.getByText(tk("orderEmpty"))).toBeVisible();

    // Menú de tarjetas: tocar dos veces el mismo producto sube la cantidad y la tarjeta la muestra.
    const card = page.locator('button[aria-label$="agregar"]:not([disabled])').first();
    await card.click();
    await expect(card.locator("span[aria-label$='en la orden']")).toHaveText("1");
    await card.click();
    await expect(card.locator("span[aria-label$='en la orden']")).toHaveText("2");

    // La orden sube y baja la cantidad sin salir de la pantalla.
    await page.getByRole("button", { name: /^Quitar una unidad de / }).click();
    await expect(card.locator("span[aria-label$='en la orden']")).toHaveText("1");
    await page.getByRole("button", { name: /^Agregar una unidad de / }).click();
    await expect(card.locator("span[aria-label$='en la orden']")).toHaveText("2");

    // Mandar a cocina: los renglones pasan a "Ya mandado".
    await page.getByRole("button", { name: tk("send"), exact: true }).click();
    await expect(page.getByText(tk("sentSection"))).toBeVisible();

    // Cobrar en efectivo; si la cocina no ha entregado, se confirma el cobro.
    await page.getByRole("button", { name: tk("charge"), exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(tk("pay.received")).fill("5000");
    await dialog.getByRole("button", { name: tk("pay.confirm") }).click();
    const anyway = dialog.getByRole("button", { name: tk("pay.chargeAnyway") });
    await expect(anyway.or(dialog.getByText(/^Ticket /))).toBeVisible();
    if (await anyway.isVisible()) await anyway.click();
    await expect(dialog.getByText(/^Ticket T-/)).toBeVisible();
    await dialog.getByRole("button", { name: tk("pay.close") }).click();

    // La mesa quedó libre de nuevo.
    await expect(tile(page, tableName, tk("free"))).toBeVisible();
  });

  test("[PED-004] una mesa abierta por error se libera sin ordenar nada @pr", async ({ page }) => {
    await page.goto("/es/pedido");
    const free = page.getByRole("button", { name: /, Libre$/ }).first();
    await expect(free).toBeVisible();
    const tableName = tableNameOf(await free.getAttribute("aria-label"));

    await free.click();
    await expect(tile(page, tableName, tk("occupied"))).toBeVisible();
    await page.getByRole("button", { name: tk("release") }).click();

    // Sin productos no pide confirmar: la mesa vuelve a estar libre.
    await expect(tile(page, tableName, tk("free"))).toBeVisible();
    await expect(page.getByText(tk("pickTable"), { exact: true })).toBeVisible();
  });

  test("[PED-005] las cuentas abiertas se ven en Órdenes (todas) y en Mis órdenes (las del operador) @pr", async ({ page, browser }) => {
    test.setTimeout(120_000);
    // El administrador abre una mesa y el operador otra.
    const adminTable = await openFreeTable(page);
    const staffContext = await browser.newContext({ storageState: storageStatePath("staff", "sazon.demo") });
    const staff = await staffContext.newPage();
    const staffTable = await openFreeTable(staff);

    // Mis órdenes del operador: solo la suya.
    await staff.goto("/es/mis-ordenes");
    await expect(staff.getByRole("link", { name: tk("openChecksOpen", { name: staffTable }) })).toBeVisible();
    await expect(staff.getByRole("link", { name: tk("openChecksOpen", { name: adminTable }) })).toHaveCount(0);

    // Órdenes del administrador: las dos; abrir una lleva a Tomar pedido con esa cuenta y volver regresa a Órdenes.
    await page.goto("/es/ordenes");
    await expect(page.getByRole("link", { name: tk("openChecksOpen", { name: staffTable }) })).toBeVisible();
    await page.getByRole("link", { name: tk("openChecksOpen", { name: adminTable }) }).click();
    await expect(page).toHaveURL(/\/es\/pedido\?cuenta=\d+&from=ordenes$/);
    await expect(page.getByRole("heading", { name: adminTable, exact: true })).toBeVisible();
    await page.getByRole("button", { name: tk("release") }).click(); // limpia su mesa
    await page.getByRole("button", { name: tk("back") }).click();
    await expect(page).toHaveURL(/\/es\/ordenes$/);

    // Limpia la mesa del operador para no dejar cuentas abiertas.
    await staff.getByRole("link", { name: tk("openChecksOpen", { name: staffTable }) }).click();
    await staff.getByRole("button", { name: tk("release") }).click();
    await expect(tile(staff, staffTable, tk("free"))).toBeVisible();
    await staffContext.close();
  });

  test("[PED-003] el menú lateral no tiene la entrada suelta y volver regresa a Restaurante @pr", async ({ page }) => {
    await page.goto("/es/restaurante");
    await expect(page.getByRole("link", { name: tk("title"), exact: true })).toHaveCount(1); // el botón de la página
    await expect(page.getByRole("navigation").getByRole("link", { name: tk("title"), exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: tk("title"), exact: true }).click();
    await page.getByRole("button", { name: tk("back") }).click();
    await expect(page).toHaveURL(/\/es\/restaurante$/);

    // La dirección escrita a mano sigue funcionando y vuelve a Órdenes.
    await page.goto("/es/pedido");
    await expect(page.getByRole("heading", { name: tk("title") })).toBeVisible();
    await page.getByRole("button", { name: tk("back") }).click();
    await expect(page).toHaveURL(/\/es\/ordenes$/);
  });

  test.describe("teléfono", () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test("[PED-002] en pantalla chica se alternan Mesas, Orden y Menú @regresion", async ({ page }) => {
      await page.goto("/es/pedido");
      const tabs = page.getByRole("navigation", { name: tk("title") });
      await expect(tabs.getByRole("button", { name: tk("tables") })).toBeVisible();
      await expect(page.getByLabel(tk("search"))).toBeHidden();

      await tabs.getByRole("button", { name: tk("menu") }).click();
      await expect(page.getByLabel(tk("search"))).toBeVisible();
      await tabs.getByRole("button", { name: tk("order") }).click();
      await expect(page.getByText(tk("pickTable"), { exact: true })).toBeVisible();
    });
  });
});
