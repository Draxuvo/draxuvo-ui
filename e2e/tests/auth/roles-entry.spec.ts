import { expect, test, type Page } from "@playwright/test";
import { knownFailure } from "../../support/known-failure";
import { t } from "../../support/i18n";
import { DEMO_PASSWORD, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, storageStatePath } from "../../support/session";

const ANON = { cookies: [], origins: [] };

async function login(page: Page, email: string, password: string) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
}

const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });

test.describe("staff", () => {
  test.use({ storageState: ANON });

  test("[VEM-001] el staff entra a su vista, con su menú, y sale @pr", async ({ page, context }) => {
    await login(page, "staff@volta.demo", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/es\/mis-ordenes$/);
    expect((await context.cookies()).find((c) => c.name === "user_role")?.value).toBe("staff");

    await expect(menu(page).getByRole("link")).toHaveText([
      t("workOrders.myOrders"),
      t("tickets.myTickets"),
      t("nav.profile"),
    ]);

    for (const route of ["login", "registro"]) {
      await page.goto(`/es/${route}`);
      await expect(page, route).toHaveURL(/\/es\/mis-ordenes$/);
    }

    await page.getByRole("button", { name: t("nav.logout") }).click();
    await expect(page).toHaveURL(/\/es\/login$/);
  });
});

test.describe("super admin", () => {
  test.use({ storageState: ANON });

  test("[SAD-014] el super admin entra a empresas, con su menú y sin selector de empresa @regresion", async ({ page }) => {
    await login(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/es\/empresas$/);

    await expect(menu(page).getByRole("link")).toHaveText([
      t("nav.dashboard"),
      t("nav.companies"),
      t("nav.users"),
      t("nav.subscriptions"),
      t("nav.reports"),
    ]);
    await expect(page.getByRole("button", { name: /Cambiar de empresa/ })).toHaveCount(0);

    await page.goto("/es/login");
    await expect(page).toHaveURL(/\/es\/empresas$/);
  });
});

test.describe("dueño frente a las pantallas de super admin", () => {
  test.use({ storageState: storageStatePath("owner", "volta.demo") });

  test("[SAD-014] el dueño no se queda en las pantallas de super admin @regresion", async ({ page }) => {
    knownFailure("H-06");
    for (const route of ["empresas", "usuarios", "suscripciones", "estadisticas"]) {
      await page.goto(`/es/${route}`);
      await expect(page, route).not.toHaveURL(new RegExp(`/es/${route}$`));
    }
  });
});

test.describe("inicio por rol y plan", () => {
  test.describe("dueño de Don Chuy (plan Básico)", () => {
    test.use({ storageState: storageStatePath("owner", "donchuy.demo") });

    test("[EMP-024] el dueño ve sus tarjetas y las lleva a listas filtradas @regresion", async ({ page }) => {
      await page.goto("/es/inicio");
      await expect(page.getByText(t("home.todaySummary"))).toBeVisible();
      await expect(page.getByText(t("home.shortcuts"))).toBeVisible();
      for (const key of ["activeEmployees", "totalProducts", "lowStock", "activePlan"]) {
        await expect(page.getByText(t(`home.${key}`), { exact: true })).toBeVisible();
      }
      // El plan Básico no incluye órdenes: sin tarjetas de órdenes.
      await expect(page.getByText(/órdenes/i)).toHaveCount(0);

      await page.getByRole("link", { name: /empleados? activos?/i }).first().click();
      await expect(page).toHaveURL(/\/es\/empleados\?.*status=active/);
      await page.goBack();
      await page.getByRole("link", { name: /stock bajo/i }).first().click();
      await expect(page).toHaveURL(/\/es\/inventario\?.*low_stock=true/);
    });
  });
});
