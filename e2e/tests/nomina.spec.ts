import { expect, test } from "@playwright/test";
import { storageStatePath } from "../support/session";
import { t } from "../support/i18n";

// Spec 037: pago de nómina en Personal. Corrida de punta a punta con el dueño de Volta y permisos del gerente.
// Cada corrida usa un periodo lejano distinto para no empalmarse con las de otras ejecuciones (la base demo conserva
// las corridas pagadas).

function farPeriod() {
  const base = new Date(Date.UTC(2000, 0, 1) + (Math.floor(Date.now() / 1000) % 500) * 16 * 86_400_000);
  const end = new Date(base.getTime() + 14 * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(base), to: iso(end) };
}

test.describe("nómina (spec 037)", () => {
  test.use({ storageState: storageStatePath("owner", "volta.demo") });

  test("[NOM-001] el dueño prepara, ajusta, aprueba, paga y abre el recibo @pr", async ({ page }) => {
    const { from, to } = farPeriod();
    await page.goto("/es/personal?tab=nomina");

    await page.getByRole("button", { name: t("payroll.newRun") }).click();
    const dialog = page.getByRole("dialog", { name: t("payroll.new.title") });
    await dialog.getByLabel(t("payroll.new.from")).fill(from);
    await dialog.getByLabel(t("payroll.new.to")).fill(to);
    await dialog.getByRole("button", { name: t("payroll.new.create") }).click();

    // Borrador: las fichas sin salario (dueño, administrador…) se quitan para poder aprobar.
    await expect(page.getByRole("button", { name: t("payroll.detail.approve") })).toBeVisible();
    const noSalary = page.getByText(t("payroll.detail.noSalary"));
    while ((await noSalary.count()) > 0) {
      const before = await noSalary.count();
      await noSalary.first().locator("xpath=ancestor::tr").getByRole("button", { name: new RegExp(t("payroll.detail.removeLine")) }).click();
      await expect(noSalary).toHaveCount(before - 1);
    }

    // Un bono de $500 a la primera línea.
    await page.getByRole("button", { name: new RegExp(`^${t("payroll.detail.adjust")}:`) }).first().click();
    const adjust = page.getByRole("dialog");
    await adjust.getByLabel(t("payroll.adjust.amount")).fill("500");
    await adjust.getByLabel(t("payroll.adjust.note"), { exact: true }).fill("Puntualidad");
    await adjust.getByRole("button", { name: t("payroll.adjust.add") }).click();
    await expect(adjust.getByText("Puntualidad")).toBeVisible();
    await adjust.getByRole("button", { name: t("payroll.adjust.close") }).click();

    // Aprobar, pagar todos por transferencia con referencia y abrir un recibo.
    await page.getByRole("button", { name: t("payroll.detail.approve") }).click();
    await page.getByRole("dialog").getByRole("button", { name: t("payroll.detail.confirm") }).click();
    await expect(page.getByRole("button", { name: t("payroll.detail.payAll") })).toBeVisible();

    await page.getByRole("button", { name: t("payroll.detail.payAll") }).click();
    const pay = page.getByRole("dialog");
    await pay.getByLabel(t("payroll.pay.method")).selectOption("transfer");
    await pay.getByLabel(t("payroll.pay.reference")).fill("SPEI e2e");
    await pay.getByRole("button", { name: t("payroll.pay.confirm") }).click();
    await expect(page.getByRole("button", { name: t("payroll.detail.payAll") })).toHaveCount(0);

    await page.getByRole("link", { name: new RegExp(t("payroll.detail.receipt")) }).first().click();
    const receipt = page.getByRole("article", { name: t("payroll.receipt.title") });
    await expect(receipt).toContainText(t("payroll.method.transfer"));
    await expect(receipt).toContainText("SPEI e2e");
  });
});

test.describe("nómina, permisos (spec 037)", () => {
  test.use({ storageState: storageStatePath("manager", "volta.demo") });

  test("[NOM-002] el gerente no ve la pestaña Nómina @pr", async ({ page }) => {
    await page.goto("/es/personal");
    await expect(page.getByRole("tab", { name: t("people.tabs.employees") })).toBeVisible();
    await expect(page.getByRole("tab", { name: t("people.tabs.payroll") })).toHaveCount(0);
  });
});
