import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCompany, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { knownFailure } from "../support/known-failure";
import { storageStatePath } from "../support/session";

const ANON = { cookies: [], origins: [] };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const pr = (key: string) => t(`profile.${key}`);
const ap = (key: string) => t(`appearance.${key}`);
const html = (page: Page) => page.locator("html");
const english = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "messages", "en.json"), "utf-8"));

async function login(page: Page, email: string, password: string) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
  await expect(page).toHaveURL(/\/es\/inicio$/);
}

/** Dueño de una empresa nueva: sus cambios de perfil no tocan a los usuarios de demo. */
async function ownerOf(browser: Browser, company: NewCompany) {
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await login(page, company.email, company.password);
  return { context, page };
}

async function openProfile(page: Page, company: NewCompany) {
  await page.getByRole("button", { name: new RegExp(company.email) }).click();
  await page.getByRole("menuitem", { name: t("nav.profile") }).click();
  await expect(page).toHaveURL(/\/es\/perfil$/);
}

test("[PER-009] el perfil se edita, se cancela y se guarda; la cuenta no deja editar correo ni rol @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page } = await ownerOf(browser, company);
  await openProfile(page, company);

  await expect(page.getByRole("heading", { name: pr("pageTitle"), level: 1 })).toBeVisible();
  for (const section of ["avatarSection", "editSection", "accountSection"]) {
    await expect(page.getByText(pr(section), { exact: true })).toBeVisible();
  }
  await expect(page.getByText(ap("title"), { exact: true })).toBeVisible();

  // Sin cambios no se puede guardar ni cancelar.
  const save = page.getByRole("button", { name: t("common.save") });
  const cancel = page.getByRole("button", { name: t("common.cancel") });
  const first = page.getByPlaceholder(pr("firstNamePlaceholder"), { exact: true });
  await expect(save).toBeDisabled();
  await expect(cancel).toHaveCount(0);

  const original = await first.inputValue();
  await first.fill("Otro nombre");
  await expect(save).toBeEnabled();
  await cancel.click();
  await expect(first).toHaveValue(original);
  await expect(save).toBeDisabled();

  // Un nombre vacío no se envía; uno nuevo se guarda y el encabezado lo refleja.
  const patches: string[] = [];
  page.on("request", (r) => r.method() === "PATCH" && r.url().endsWith("/profile") && patches.push(r.url()));
  await first.fill("");
  await save.click();
  await expect(page.locator("p.text-destructive")).toBeVisible();
  expect(patches).toHaveLength(0);
  await first.fill("Marina");
  await save.click();
  await expect(page.getByText(pr("saveSuccess"))).toBeVisible();
  await expect(page.getByRole("banner").getByText(/Marina/)).toBeVisible();

  // La cuenta: correo, rol en la empresa activa y estado, sin campos editables.
  const account = page.getByText(pr("accountSection"), { exact: true }).locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(account).toContainText(company.email);
  await expect(account).toContainText(t("adminUsers.roles.owner"));
  await expect(account).toContainText(pr("active"));
  await expect(account.getByRole("textbox")).toHaveCount(0);
  await context.close();
});

test("[PER-010] la foto se sube, se quita y un archivo inválido no la cambia @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page } = await ownerOf(browser, company);
  await openProfile(page, company);
  const input = page.locator('input[type="file"]');
  const remove = page.getByRole("button", { name: pr("deleteAvatar") });

  await expect(remove).toHaveCount(0);
  await input.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(pr("avatarUpdated"))).toBeVisible();
  await expect(remove).toBeVisible();

  // Un PDF y una imagen de más de 5 MB los rechaza la API; la foto anterior se queda.
  await input.setInputFiles({ name: "documento.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByText(/Tipo de archivo no permitido/)).toBeVisible();
  await input.setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]) });
  await expect(page.getByText(/demasiado grande/)).toBeVisible();
  await expect(remove).toBeVisible();

  await remove.click();
  await expect(page.getByText(pr("avatarDeleted"))).toBeVisible();
  await expect(remove).toHaveCount(0);
  await context.close();
});

test("[PER-010] un PDF renombrado a .png no se acepta como foto @regresion", async ({ browser, request }, info) => {
  knownFailure("H-24");
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page } = await ownerOf(browser, company);
  await openProfile(page, company);
  await page.locator('input[type="file"]').setInputFiles({ name: "falsa.png", mimeType: "image/png", buffer: Buffer.from("%PDF-1.4 no soy una imagen") });
  await expect(page.getByText(/Tipo de archivo no permitido/)).toBeVisible();
  await context.close();
});

test("[PER-011] el modo y el tema se aplican al instante, se guardan en la cuenta y sobreviven a otra sesión @regresion", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page } = await ownerOf(browser, company);
  await openProfile(page, company);
  const radio = (name: string | RegExp) => page.getByRole("radio", { name });
  // Los radios están ocultos y guardan por la API: click y esperar.
  const choose = async (name: string | RegExp) => {
    const saved = page.waitForResponse((r) => r.url().endsWith("/profile") && r.request().method() === "PATCH");
    await radio(name).click({ force: true });
    await saved;
  };
  const theme = (key: string) => new RegExp(`^${ap(`themes.${key}.name`)}\\.`);

  await expect(radio(theme("anaquel"))).toBeChecked();
  await expect(page.getByText(ap("active"), { exact: true })).toBeVisible();
  await choose(ap("modes.dark"));
  await expect(html(page)).toHaveAttribute("data-mode", "dark");
  await choose(ap("modes.light"));
  await expect(html(page)).toHaveAttribute("data-mode", "light");
  for (const key of ["mercado", "talavera", "rosa_mexicano", "grafito"]) {
    await choose(theme(key));
    await expect(html(page)).toHaveAttribute("data-theme", key);
    await expect(radio(theme(key))).toBeChecked();
  }
  await choose(ap("modes.dark"));

  // Recargar y entrar desde otro navegador conserva lo guardado en la cuenta.
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "grafito");
  await expect(html(page)).toHaveAttribute("data-mode", "dark");
  const other = await browser.newContext({ storageState: ANON });
  const otherPage = await other.newPage();
  await login(otherPage, company.email, company.password);
  await expect(html(otherPage)).toHaveAttribute("data-theme", "grafito");
  await expect(html(otherPage)).toHaveAttribute("data-mode", "dark");
  await other.close();

  // Si la cuenta no puede guardarlo, el cambio queda en este dispositivo y lo avisa.
  await page.route("**/api/v1/profile", (route) => (route.request().method() === "PATCH" ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.fallback()));
  await radio(theme("talavera")).click({ force: true });
  await expect(page.getByText(ap("saveFailed"))).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-theme", "talavera");
  await context.close();
});

test.describe("administrador de Volta", () => {
  test.use({ storageState: storageStatePath("admin", "volta.demo") });

  test("[PER-012] el idioma cambia de ruta y de textos sin perder la sesión y la API recibe el idioma @regresion", async ({ page }) => {
    /** Recarga y devuelve el idioma que la API recibió en la primera llamada. */
    const reloadAndReadLocale = async () => {
      const [request] = await Promise.all([page.waitForRequest((r) => r.url().includes("/api/v1/")), page.reload()]);
      return request.headers()["locale"];
    };

    await page.goto("/es/inicio");
    await expect(menuLink(page, t("nav.people"))).toBeVisible();
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/inicio$/);
    await expect(html(page)).toHaveAttribute("lang", "en");
    expect(await reloadAndReadLocale()).toBe("en");

    await menuLink(page, english.nav.people).click();
    await expect(page).toHaveURL(/\/en\/personal$/);
    await expect(page.getByRole("heading", { name: english.people.title, level: 1 })).toBeVisible();
    await menuLink(page, english.nav.inventory).click();
    await expect(page).toHaveURL(/\/en\/inventario$/);
    await expect(page.getByRole("heading", { name: english.inventory.title, level: 1 })).toBeVisible();
    // La sesión sigue abierta: no hubo salto al login y los textos en español ya no están.
    await expect(page.getByRole("heading", { name: t("inventory.title") })).toHaveCount(0);

    await page.getByRole("button", { name: "ES", exact: true }).click();
    await expect(page).toHaveURL(/\/es\/inventario$/);
    await expect(page.getByRole("heading", { name: t("inventory.title"), level: 1 })).toBeVisible();
    expect(await reloadAndReadLocale()).toBe("es");
  });
});

function menuLink(page: Page, name: string) {
  return page.getByRole("navigation").getByRole("link", { name, exact: true });
}
