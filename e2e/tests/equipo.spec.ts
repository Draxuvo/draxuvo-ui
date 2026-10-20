import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCompany, E2E_PASSWORD, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { knownFailure } from "../support/known-failure";
import { setDisabledModules } from "../support/modules";
import { API_URL, authFile, storageStatePath } from "../support/session";
import { setPasswordPath } from "../support/tokens";

const ANON = { cookies: [], origins: [] };
const PASSWORD_FIELD = "••••••••";
const role = (key: string) => t(`adminUsers.roles.${key}`);
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });
const switcher = (page: Page) => page.getByRole("button", { name: /Cambiar de empresa/ });

async function login(page: Page, email: string, password: string) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
}

/** Contexto con la sesión del dueño de una empresa recién creada, entrada por la pantalla de login. */
async function ownerOf(browser: Browser, company: NewCompany) {
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await login(page, company.email, company.password);
  await expect(page).toHaveURL(/\/es\/inicio$/);
  const companyId = await page.evaluate(() => localStorage.getItem("selected_company_id") ?? "");
  return { context, page, headers: { Authorization: `Bearer ${company.token}`, "X-Company-Id": companyId } };
}

async function invite(page: Page, person: { email: string; first?: string; last?: string; phone?: string; role?: string }) {
  await page.getByRole("button", { name: t("team.invite") }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder(t("team.emailPlaceholder")).fill(person.email);
  if (person.first) await sheet.getByLabel(t("team.firstName")).fill(person.first);
  if (person.last) await sheet.getByLabel(t("team.lastName")).fill(person.last);
  if (person.phone) await sheet.getByLabel(t("team.phone")).fill(person.phone);
  if (person.role) await sheet.getByLabel(t("team.role")).selectOption({ label: person.role });
  await sheet.getByRole("button", { name: t("team.send"), exact: true }).click();
  return sheet;
}

const row = (page: Page, text: string) => page.getByRole("listitem").filter({ hasText: text });

// Cuarentena (spec 010): falló o fue inestable en la primera corrida local. Arreglar o borrar en 14 días.
test("[FLU-02] el dueño da de alta un empleado con correo; entra como staff y, al subir de rol, al inicio @pr @flaky", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const prefix = uniquePrefix(info.workerIndex);
  const person = { name: `Pedro ${prefix}`, email: `${prefix}@mailinator.com` };
  const owner = await ownerOf(browser, company);

  // 1. El dueño crea al empleado con correo (EPL-003): nace inactivo, esperando su contraseña.
  await owner.page.goto("/es/empleados");
  await owner.page.getByRole("button", { name: t("employees.new") }).click();
  const sheet = owner.page.getByRole("dialog");
  await sheet.getByPlaceholder(t("employees.namePlaceholder")).fill(person.name);
  await sheet.getByPlaceholder(t("employees.emailPlaceholder")).fill(person.email);
  await sheet.getByPlaceholder(t("employees.phonePlaceholder")).fill("5512345678");
  await sheet.getByRole("button", { name: t("employees.save") }).click();
  await expect(owner.page.getByText(t("employees.createSuccess"))).toBeVisible();
  await expect(owner.page.getByRole("row").filter({ hasText: person.name })).toContainText(t("employees.inactive"));

  // Es miembro de la empresa con rol staff; su id firma el enlace de alta (no hay correo real).
  const members = await request.get(`${API_URL}/api/v1/company/members`, { headers: owner.headers });
  const member = (await members.json()).results.find((m: { email: string }) => m.email === person.email);
  expect(member.role).toBe("staff");

  // 2. El invitado abre el enlace, fija su contraseña (AUT-020/022) y entra a /mis-ordenes (VEM-001).
  const guest = await browser.newContext({ storageState: ANON });
  const guestPage = await guest.newPage();
  await guestPage.goto(setPasswordPath({ id: member.id, email: person.email, fullName: person.name }));
  await guestPage.getByPlaceholder(PASSWORD_FIELD).first().fill(E2E_PASSWORD);
  await guestPage.getByPlaceholder(PASSWORD_FIELD).nth(1).fill(E2E_PASSWORD);
  await guestPage.getByRole("button", { name: t("setPassword.submit") }).click();
  await expect(guestPage.getByText(t("setPassword.successTitle"))).toBeVisible();
  await expect(guestPage).toHaveURL(/\/es\/login/, { timeout: 8000 });
  await login(guestPage, person.email, E2E_PASSWORD);
  await expect(guestPage).toHaveURL(/\/es\/mis-ordenes$/);
  await expect(menu(guestPage).getByRole("link", { name: t("nav.team") })).toHaveCount(0);

  // El empleado ya figura activo y ligado a su usuario.
  await owner.page.reload();
  await expect(owner.page.getByRole("row").filter({ hasText: person.name })).toContainText(t("employees.active"));

  // 3. El dueño lo sube a Gerente (EMP-010) y el invitado, al volver a entrar, llega a /inicio.
  await owner.page.goto("/es/equipo");
  await row(owner.page, person.email).getByRole("combobox").selectOption({ label: role("manager") });
  await expect(owner.page.getByText(t("team.roleUpdated", { name: person.name, role: role("manager") }))).toBeVisible();

  await guestPage.getByRole("button", { name: t("nav.logout") }).click();
  await login(guestPage, person.email, E2E_PASSWORD);
  await expect(guestPage).toHaveURL(/\/es\/inicio$/);
  await expect(menu(guestPage).getByRole("link", { name: t("nav.employees") })).toBeVisible();
  await expect(menu(guestPage).getByRole("link", { name: t("nav.team") })).toHaveCount(0);

  await guest.close();
  await owner.context.close();
});

test.describe("dueño de Volta", () => {
  test.use({ storageState: storageStatePath("owner", "volta.demo") });

  test("[EMP-006] invitar con solo el correo funciona y el correo mal escrito se valida @regresion", async ({ page }, info) => {
    knownFailure("H-11");
    const email = `${uniquePrefix(info.workerIndex)}@mailinator.com`;
    await page.goto("/es/equipo");

    // Un correo mal escrito se valida en la pantalla, sin llamar a la API.
    const sheet = await invite(page, { email: "sin-arroba" });
    await expect(sheet.getByText(t("team.emailInvalid"))).toBeVisible();

    // Nombre, apellido y teléfono se marcan opcionales: invitar solo con el correo debería bastar.
    await sheet.getByPlaceholder(t("team.emailPlaceholder")).fill(email);
    await sheet.getByRole("button", { name: t("team.send"), exact: true }).click();
    await expect(page.getByText(t("team.invited", { email }))).toBeVisible();
  });

  test("[EMP-008] invitar a quien ya es miembro avisa y no cambia la lista @regresion", async ({ page }) => {
    await page.goto("/es/equipo");
    await expect(row(page, "manager@volta.demo")).toBeVisible();
    const before = await page.getByRole("listitem").count();

    const sheet = await invite(page, { email: "manager@volta.demo" });
    await expect(sheet.getByRole("alert")).toHaveText(t("team.errors.already_member"));

    await sheet.getByRole("button", { name: t("team.cancel") }).click();
    await expect(page.getByRole("listitem")).toHaveCount(before);
  });
});

test("[EMP-012] el único propietario no se edita ni se quita desde la pantalla @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context: me, page, headers } = await ownerOf(browser, company);
  await page.goto("/es/equipo");

  // Su fila lleva "Tú", sin selector de rol ni botón de quitar.
  const own = row(page, company.email);
  await expect(own).toContainText(t("team.you"));
  await expect(own.getByRole("combobox")).toHaveCount(0);
  await expect(own.getByRole("button", { name: /Quitar/, includeHidden: true })).toBeDisabled();

  // La API lo respalda: bajar el propio rol o salirse da 422 `last_owner`.
  const demote = await request.patch(`${API_URL}/api/v1/company/members/${company.userId}`, {
    headers,
    data: { member: { role: "admin" } },
  });
  expect(demote.status()).toBe(422);
  expect((await demote.json()).error.details.code).toBe("last_owner");
  const leave = await request.delete(`${API_URL}/api/v1/company/members/${company.userId}`, { headers });
  expect(leave.status()).toBe(422);

  // Si la API rechaza un cambio con `last_owner`, la pantalla explica qué hacer.
  const prefix = uniquePrefix(info.workerIndex);
  await invite(page, { email: `${prefix}@mailinator.com`, first: "Nora", last: prefix, phone: "5512345678" });
  await expect(page.getByText(t("team.invited", { email: `${prefix}@mailinator.com` }))).toBeVisible();
  await page.route("**/api/v1/company/members/*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "x", details: { code: "last_owner" } } }),
        })
      : route.fallback(),
  );
  await row(page, `${prefix}@mailinator.com`).getByRole("combobox").selectOption({ label: role("manager") });
  await expect(page.getByText(t("team.errors.last_owner"))).toBeVisible();
  await me.close();
});

test("[EMP-014] el dueño invita, cambia el rol y quita a una persona desde /equipo @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const prefix = uniquePrefix(info.workerIndex);
  const person = { email: `${prefix}@mailinator.com`, first: "Nora", last: prefix, phone: "5512345678" };
  const name = `${person.first} ${person.last}`;
  const owner = await ownerOf(browser, company);
  const page = owner.page;

  await page.goto("/es/equipo");
  await expect(page.getByRole("heading", { name: t("team.title") })).toBeVisible();
  // El plural de `team.subtitle` es ICU; t() no lo resuelve.
  await expect(page.getByText(`1 persona en ${company.companyName}`)).toBeVisible();
  const own = row(page, company.email);
  await expect(own).toContainText(t("team.you"));
  await expect(own.getByRole("combobox")).toHaveCount(0);

  await invite(page, { ...person, role: role("manager") });
  await expect(page.getByText(t("team.invited", { email: person.email }))).toBeVisible();
  await expect(row(page, person.email).getByRole("combobox")).toHaveValue("manager");

  await row(page, person.email).getByRole("combobox").selectOption({ label: role("staff") });
  await expect(page.getByText(t("team.roleUpdated", { name, role: role("staff") }))).toBeVisible();

  await row(page, person.email).getByRole("button", { name: t("team.removeLabel", { name }) }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(t("team.removeTitle"))).toBeVisible();
  await expect(dialog.getByText(t("team.removeConfirm", { name, company: company.companyName }))).toBeVisible();
  await dialog.getByRole("button", { name: t("team.remove"), exact: true }).click();
  await expect(page.getByText(t("team.removed", { name }))).toBeVisible();
  await expect(row(page, person.email)).toHaveCount(0);
  await owner.context.close();
});

test.describe("acceso a /equipo según el rol", () => {
  test.describe("gerente", () => {
    test.use({ storageState: storageStatePath("manager", "volta.demo") });

    test("[EMP-015] el gerente no ve Equipo y la URL lo regresa al inicio @regresion", async ({ page }) => {
      await page.goto("/es/inicio");
      await expect(menu(page).getByRole("link", { name: t("nav.employees") })).toBeVisible();
      await expect(menu(page).getByRole("link", { name: t("nav.team") })).toHaveCount(0);
      await page.goto("/es/equipo").catch(() => {});
      await expect(page).toHaveURL(/\/es\/inicio$/);
    });
  });

  test.describe("administrador", () => {
    test.use({ storageState: storageStatePath("admin", "volta.demo") });

    test("[EMP-015] el administrador ve Equipo, sin Propietario y sin tocar filas de propietario @regresion", async ({ page }) => {
      await page.goto("/es/inicio");
      await menu(page).getByRole("link", { name: t("nav.team") }).click();
      await expect(page).toHaveURL(/\/es\/equipo$/);

      const owners = row(page, "dueno@volta.demo");
      await expect(owners).toContainText(role("owner"));
      await expect(owners.getByRole("combobox")).toHaveCount(0);

      const select = row(page, "manager@volta.demo").getByRole("combobox");
      await expect(select.getByRole("option")).toHaveText([role("staff"), role("manager"), role("admin")]);
    });
  });

  test.describe("staff", () => {
    test.use({ storageState: storageStatePath("staff", "volta.demo") });

    test("[EMP-015] el staff termina en /mis-ordenes @regresion", async ({ page }) => {
      await page.goto("/es/equipo").catch(() => {});
      await expect(page).toHaveURL(/\/es\/mis-ordenes$/);
    });
  });
});

test("[EMP-018] el dueño ve los módulos de su plan en solo lectura; si el super admin apaga uno, la pantalla lo bloquea @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const owner = await ownerOf(browser, company);
  const page = owner.page;
  const moduleRow = (key: string) =>
    page.locator("section").filter({ has: page.getByRole("heading", { name: t("subscription.modulesTitle") }) }).getByRole("listitem").filter({ hasText: t(`modules.${key}`) });

  // 1. Solo los módulos del plan, con su estado y sin ningún interruptor (spec 017).
  await page.goto("/es/suscripcion");
  await expect(page.getByRole("heading", { name: t("subscription.modulesTitle") })).toBeVisible();
  await expect(page.getByText(t("subscription.modulesReadOnly"))).toBeVisible();
  for (const key of ["employees", "attendance", "inventory"]) {
    await expect(moduleRow(key)).toContainText(t("subscription.moduleOn"));
  }
  for (const key of ["work_orders", "whatsapp", "multi_company"]) {
    await expect(moduleRow(key)).toHaveCount(0);
  }
  await expect(page.getByRole("switch")).toHaveCount(0);

  // 2. Un cambio del dueño por la API se rechaza.
  const denied = await request.patch(`${API_URL}/api/v1/company/modules`, { headers: owner.headers, data: { disabled_modules: ["inventory"] } });
  expect(denied.status()).toBe(403);

  // 3. El super admin apaga Inventario: la pantalla del dueño lo refleja y el módulo queda bloqueado.
  await setDisabledModules(request, owner.headers["X-Company-Id"], ["inventory"]);
  await page.goto("/es/suscripcion");
  await expect(moduleRow("inventory")).toContainText(t("subscription.moduleOff"));
  await expect(menu(page).getByRole("link", { name: t("nav.inventory") })).toHaveCount(0);
  await page.goto("/es/inventario");
  await expect(page.getByText(t("subscription.moduleLocked"))).toBeVisible();
  await expect(page.getByText(t("subscription.moduleLockedDesc", { module: t("modules.inventory") }))).toBeVisible();

  // 4. Al volver a activarlo, reaparece.
  await setDisabledModules(request, owner.headers["X-Company-Id"], []);
  await page.goto("/es/suscripcion");
  await expect(moduleRow("inventory")).toContainText(t("subscription.moduleOn"));
  await owner.context.close();
});

// Cuarentena (spec 010): falló o fue inestable en la primera corrida local. Arreglar o borrar en 14 días.
test("[EMP-020] el dueño cambia el modo de órdenes a Pedido y el admin ya no ve el botón del modo @regresion @flaky", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
  const prefix = uniquePrefix(info.workerIndex);
  const owner = await ownerOf(browser, company);
  const { page, headers } = owner;

  // Un admin de la empresa, dado de alta por la API (sin correo real).
  const adminEmail = `${prefix}@mailinator.com`;
  const added = await request.post(`${API_URL}/api/v1/company/members`, {
    headers,
    data: { member: { email: adminEmail, first_name: "Ada", last_name: prefix, phone: "5512345678", role: "admin" } },
  });
  expect(added.status()).toBe(201);

  await page.goto("/es/ordenes");
  await expect(page.getByRole("button", { name: t("workOrders.labels.service.new") })).toBeVisible();
  await page.getByRole("button", { name: t("workOrders.mode.open") }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(t("workOrders.mode.serviceHint"))).toBeVisible();
  await expect(dialog.getByText(t("workOrders.mode.orderHint"))).toBeVisible();
  await expect(dialog.getByText(t("workOrders.mode.current"))).toBeVisible();
  await dialog.getByText(t("workOrders.mode.order"), { exact: true }).click();
  await dialog.getByRole("button", { name: t("workOrders.mode.save") }).click();
  await expect(page.getByText(t("workOrders.mode.saved"))).toBeVisible();

  await expect(page.getByRole("button", { name: t("workOrders.labels.order.new") })).toBeVisible();
  await page.getByRole("button", { name: t("workOrders.labels.order.new") }).click();
  await expect(page.getByRole("dialog").getByPlaceholder(/Mesa 4/)).toBeVisible();
  await owner.context.close();

  // El admin ve el modo nuevo pero no el botón para cambiarlo. Su contraseña la fija el enlace de alta.
  const guest = await browser.newContext({ storageState: ANON });
  const guestPage = await guest.newPage();
  const list = await request.get(`${API_URL}/api/v1/company/members`, { headers });
  const adminId = (await list.json()).results.find((m: { email: string }) => m.email === adminEmail).id;
  await guestPage.goto(setPasswordPath({ id: adminId, email: adminEmail, fullName: `Ada ${prefix}` }));
  await guestPage.getByPlaceholder(PASSWORD_FIELD).first().fill(E2E_PASSWORD);
  await guestPage.getByPlaceholder(PASSWORD_FIELD).nth(1).fill(E2E_PASSWORD);
  await guestPage.getByRole("button", { name: t("setPassword.submit") }).click();
  await expect(guestPage).toHaveURL(/\/es\/login/, { timeout: 8000 });
  await login(guestPage, adminEmail, E2E_PASSWORD);
  await expect(guestPage).toHaveURL(/\/es\/inicio$/);
  await guestPage.goto("/es/ordenes");
  await expect(guestPage.getByRole("button", { name: t("workOrders.labels.order.new") })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: t("workOrders.mode.open") })).toHaveCount(0);
  await guest.close();
});

test.describe("quien tiene dos empresas", () => {
  test.use({ storageState: authFile("multi-demo") });

  test("[EMP-023] cambia de empresa desde el encabezado y su rol cambia con ella @pr", async ({ page, context }) => {
    await page.goto("/es/inicio");
    await expect(page).toHaveURL(/\/es\/inicio$/);

    await switcher(page).click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(2);
    await expect(page.getByRole("menuitemradio", { name: /Electricidad Volta/ })).toContainText(role("owner"));
    await expect(page.getByRole("menuitemradio", { name: /Restaurante Sazón/ })).toContainText(role("staff"));

    await page.getByRole("menuitemradio", { name: /Restaurante Sazón/ }).click();
    await expect(page.getByText(t("companySwitcher.switched", { company: "Restaurante Sazón" }))).toBeVisible();
    await expect(page).toHaveURL(/\/es\/mis-ordenes$/);
    expect((await context.cookies()).find((c) => c.name === "user_role")?.value).toBe("staff");

    await page.goto("/es/inventario").catch(() => {});
    await expect(page).toHaveURL(/\/es\/mis-ordenes$/);

    await switcher(page).click();
    await page.getByRole("menuitemradio", { name: /Electricidad Volta/ }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);
    expect((await context.cookies()).find((c) => c.name === "user_role")?.value).toBe("owner");
    await expect(menu(page).getByRole("link", { name: t("nav.team") })).toBeVisible();
  });
});
