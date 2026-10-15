import { expect, test, type Page } from "@playwright/test";
import { knownFailure } from "../../support/known-failure";
import { t } from "../../support/i18n";
import { DEMO_PASSWORD, storageStatePath } from "../../support/session";

const ANON = { cookies: [], origins: [] };

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
}

test.describe("sin sesión", () => {
  test.use({ storageState: ANON });

  test("[AUT-002] el dueño entra y llega a su inicio @pr", async ({ page, context }) => {
    await page.goto("/es/login");
    await fillLogin(page, "dueno@volta.demo", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/es\/inicio$/);

    const cookies = Object.fromEntries((await context.cookies()).map((c) => [c.name, c.value]));
    expect(cookies.user_role).toBe("owner");
    expect(cookies.auth_token).toBeTruthy();
    const stored = await page.evaluate(() => ({
      token: localStorage.getItem("auth_token"),
      company: localStorage.getItem("selected_company_id"),
    }));
    expect(stored.token).toBeTruthy();
    expect(stored.company).toBeTruthy();
  });

  test("[AUT-003] campos vacíos o correo inválido no llaman a la API @regresion", async ({ page }) => {
    const calls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/auth/login")) calls.push(r.url());
    });
    await page.goto("/es/login");

    await page.getByRole("button", { name: t("auth.submit") }).click();
    await expect(page.getByText(t("auth.emailInvalid"))).toBeVisible();
    await expect(page.getByText(t("auth.passwordRequired"))).toBeVisible();

    await page.getByLabel(t("auth.email"), { exact: true }).fill("no-es-correo");
    await page.getByLabel(t("auth.password"), { exact: true }).fill("algo-1234");
    await page.getByRole("button", { name: t("auth.submit") }).click();
    await expect(page.getByText(t("auth.emailInvalid"))).toBeVisible();

    expect(calls).toHaveLength(0);
    await expect(page).toHaveURL(/\/es\/login$/);
  });

  test("[AUT-004] contraseña incorrecta avisa y no inicia sesión @pr", async ({ page, context }) => {
    await page.goto("/es/login");
    await fillLogin(page, "dueno@volta.demo", "incorrecta1");

    await expect(page.getByText("Contraseña incorrecta")).toBeVisible();
    await expect(page).toHaveURL(/\/es\/login$/);
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("auth_token");
  });

  test("[AUT-028] quien tiene dos empresas entra a la primera y puede cambiar @regresion", async ({ page }) => {
    await page.goto("/es/login");
    await fillLogin(page, "multi@demo.demo", DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/es\/inicio$/);

    await page.getByRole("button", { name: /Cambiar de empresa/ }).click();
    await expect(page.getByText(t("companySwitcher.heading"))).toBeVisible();
  });
});

test.describe("con sesión", () => {
  test.use({ storageState: storageStatePath("owner", "volta.demo") });

  test("[AUT-008] un token vencido en el panel regresa al login @regresion", async ({ page }) => {
    knownFailure("H-12");
    await page.goto("/es/inicio");
    await expect(page).toHaveURL(/\/es\/inicio$/);

    // Un token firmado con otra clave: la API lo rechaza con 401.
    await page.evaluate(() => localStorage.setItem("auth_token", "eyJhbGciOiJIUzI1NiJ9.e30.invalido"));
    // La app redirige a mitad de la carga: goto puede abortar y eso es parte del caso.
    await page.goto("/es/empleados").catch(() => {});

    await expect(page).toHaveURL(/\/es\/login/);
    // H-12: la cookie sigue viva y proxy.ts devuelve al usuario al panel; debe quedarse en login.
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/es\/login/);
  });
});

test.describe("cierre de sesión", () => {
  test.use({ storageState: storageStatePath("admin", "volta.demo") });

  test("[AUT-009] cerrar sesión limpia el acceso y bloquea volver @regresion", async ({ page, context }) => {
    await page.goto("/es/inicio");
    await page.getByRole("button", { name: /admin@volta\.demo/ }).click();
    await page.getByRole("menuitem", { name: t("nav.logout") }).click();
    await expect(page).toHaveURL(/\/es\/login$/);

    const names = (await context.cookies()).map((c) => c.name);
    expect(names).not.toContain("auth_token");
    expect(names).not.toContain("user_role");
    const stored = await page.evaluate(() => ({
      token: localStorage.getItem("auth_token"),
      company: localStorage.getItem("selected_company_id"),
    }));
    expect(stored.token).toBeNull();
    expect(stored.company).toBeNull();

    await page.goBack();
    await page.goto("/es/inicio");
    await expect(page).toHaveURL(/\/es\/login$/);
  });
});
