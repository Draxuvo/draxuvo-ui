import { expect, test, type Locator, type Page } from "@playwright/test";
import { uniquePrefix } from "../support/data";
import { t } from "../support/i18n";
import { knownFailure } from "../support/known-failure";
import { API_URL, storageStatePath } from "../support/session";

const emp = (key: string, values?: Record<string, string | number>) => t(`employees.${key}`, values);
const att = (key: string, values?: Record<string, string | number>) => t(`attendance.${key}`, values);
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });
const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
/** Los dos íconos del final de cada fila (solo tooltip): editar y eliminar. */
const edit = (r: Locator) => r.getByRole("button").nth(-2);
const remove = (r: Locator) => r.getByRole("button").last();
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

/** Cabeceras de la sesión abierta en la página, para llamar a la API como ese usuario. */
async function apiHeaders(page: Page) {
  const { token, companyId } = await page.evaluate(() => ({
    token: localStorage.getItem("auth_token") ?? "",
    companyId: localStorage.getItem("selected_company_id") ?? "",
  }));
  return { Authorization: `Bearer ${token}`, "X-Company-Id": companyId };
}

async function createEmployee(page: Page, name: string) {
  await page.getByRole("button", { name: emp("new") }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByPlaceholder(emp("namePlaceholder")).fill(name);
  await sheet.getByRole("button", { name: emp("save") }).click();
  await expect(page.getByText(emp("createSuccess"))).toBeVisible();
}

test.describe("permisos por rol en empleados y asistencia", () => {
  test.describe("staff", () => {
    test.use({ storageState: storageStatePath("staff", "volta.demo") });

    test("[EPL-013] el staff no llega a Personal ni a Asistencia @regresion", async ({ page }) => {
      for (const route of ["empleados", "asistencia"]) {
        await page.goto(`/es/${route}`).catch(() => {});
        await expect(page, route).toHaveURL(/\/es\/mis-ordenes$/);
      }
    });

    test("[EPL-013] la API le niega la lista de empleados al staff @regresion", async ({ page }) => {
      knownFailure("H-02");
      await page.goto("/es/mis-ordenes");
      const response = await page.request.get(`${API_URL}/api/v1/employees`, { headers: await apiHeaders(page) });
      expect(response.status()).toBe(403);
    });
  });

  for (const role of ["manager", "admin", "owner"] as const) {
    test.describe(role, () => {
      test.use({ storageState: storageStatePath(role, "volta.demo") });

      test(`[EPL-013] ${role} ve Personal y Asistencia en el menú y abre las dos pantallas @regresion`, async ({ page }) => {
        await page.goto("/es/inicio");
        await expect(menu(page).getByRole("link", { name: t("nav.people") })).toBeVisible();
        // Una sola opción (spec 036): Asistencia ya no tiene lugar propio en el menú.
        await expect(menu(page).getByRole("link", { name: t("nav.attendance") })).toHaveCount(0);
        await page.goto("/es/empleados");
        await expect(page.getByRole("heading", { name: t("people.title"), level: 1 })).toBeVisible();
        await expect(page).toHaveURL(/\/es\/personal\?tab=empleados$/);
        await page.goto("/es/asistencia");
        await expect(page).toHaveURL(/\/es\/personal\?tab=asistencia$/);
        await expect(page.getByRole("tab", { name: t("people.tabs.attendance"), selected: true })).toBeVisible();
      });
    });
  }
});

test.describe("manager de Volta", () => {
  test.use({ storageState: storageStatePath("manager", "volta.demo") });

  test("[EPL-014] lista, búsqueda y filtro de estado; los filtros viven en la URL @regresion", async ({ page }) => {
    await page.goto("/es/empleados");
    await expect(page.getByRole("heading", { name: emp("title"), level: 1 })).toBeVisible();
    await expect(page.getByText(/^\d+ empleados registrados$/)).toBeVisible();
    for (const column of ["name", "email", "phone", "position", "status", "actions"]) {
      await expect(page.getByRole("columnheader", { name: emp(column), exact: true })).toBeVisible();
    }

    // "campo" encuentra a Luis y a Jorge, del área de Campo.
    await page.getByPlaceholder(emp("searchPlaceholder")).fill("campo");
    await expect(page).toHaveURL(/search=campo/);
    await expect(page.getByRole("row")).toHaveCount(3);
    await expect(row(page, "Luis")).toBeVisible();
    await expect(row(page, "Jorge")).toBeVisible();

    const chip = (key: string) => page.getByRole("group", { name: emp("filters.status") }).getByRole("button", { name: emp(`filters.${key}`), exact: true });
    await chip("inactive").click();
    await expect(page).toHaveURL(/status=inactive/);
    await expect(page.getByText(t("common.filters.noResults"))).toBeVisible();
    await chip("active").click();
    await expect(page).toHaveURL(/status=active/);
    await expect(page.getByRole("row")).toHaveCount(3);
    await chip("all").click();
    await expect(page).not.toHaveURL(/status=/);

    await page.getByRole("button", { name: t("common.filters.clear") }).click();
    await expect(page).not.toHaveURL(/search=/);

    // Los filtros se restauran al recargar con ellos en la URL.
    await page.goto("/es/empleados?status=active&search=ana");
    await expect(chip("active")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByPlaceholder(emp("searchPlaceholder"))).toHaveValue("ana");
    await expect(row(page, "Ana")).toBeVisible();
  });

  test("[EPL-017] asistencia: hoy por defecto, rango, filtros combinados y fechas inválidas @regresion", async ({ page }) => {
    await page.goto("/es/asistencia");
    await expect(page.getByText(att("subtitleToday"))).toBeVisible();
    await expect(page.getByRole("heading", { name: att("roster.title") })).toBeVisible();

    await page.getByLabel(att("from")).fill(day(-14));
    await expect(page.getByText(new RegExp(`^${att("subtitleRange", { from: ".+", to: ".+" })}`))).toBeVisible();
    await expect(page.getByText(att("types.normal"), { exact: true }).first()).toBeVisible();

    // Filtra por un empleado y por el tipo "Tarde": se combinan en la URL.
    const employee = page.getByLabel(att("filterEmployee"));
    await employee.selectOption({ index: 1 });
    await expect(page).toHaveURL(/employee_id=\d+/);
    await page.getByRole("group", { name: att("filterType") }).getByRole("button", { name: att("types.late"), exact: true }).click();
    await expect(page).toHaveURL(/type=late/);
    await expect(page).toHaveURL(/employee_id=\d+/);

    // "Hoy" restablece las fechas; un rango sin registros lo dice.
    await page.getByRole("button", { name: att("today"), exact: true }).click();
    await expect(page).not.toHaveURL(/from=/);
    await page.goto("/es/asistencia?from=2000-01-01&to=2000-01-07");
    await expect(page.getByText(att("empty"))).toBeVisible();

    // Una fecha con formato inválido vuelve a hoy.
    await page.goto("/es/asistencia?from=ayer");
    await expect(page.getByText(att("subtitleToday"))).toBeVisible();
  });

  test("[EPL-017] la pantalla de Personal tiene botones de entrada y salida @regresion", async ({ page }) => {
    knownFailure("H-20");
    await page.goto("/es/empleados");
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expect(page.getByRole("button", { name: emp("checkin"), exact: true }).first()).toBeVisible();
  });
});

test.describe("dueño de Don Chuy", () => {
  test.use({ storageState: storageStatePath("owner", "donchuy.demo") });

  // Cuarentena (spec 010): falló o fue inestable en la primera corrida local. Arreglar o borrar en 14 días.
  test("[EPL-015] crea y edita un empleado desde la pantalla @pr @flaky", async ({ page }, info) => {
    const prefix = uniquePrefix(info.workerIndex);
    const name = `Pedro ${prefix}`;
    await page.goto("/es/empleados");

    // Sin nombre no se guarda.
    await page.getByRole("button", { name: emp("new") }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(emp("createTitle"), { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: emp("save") }).click();
    await expect(sheet.getByText(emp("nameRequired"))).toBeVisible();

    await sheet.getByPlaceholder(emp("namePlaceholder")).fill(name);
    await sheet.getByPlaceholder(emp("positionPlaceholder")).fill("Ayudante");
    await sheet.getByPlaceholder(emp("departmentPlaceholder")).fill("Piso");
    await sheet.getByPlaceholder(emp("salaryPlaceholder")).fill("9000");
    await sheet.getByPlaceholder(emp("emailPlaceholder")).fill(`${prefix}@mailinator.com`);
    await sheet.getByPlaceholder(emp("phonePlaceholder")).fill("5512345678");
    await sheet.getByRole("button", { name: emp("save") }).click();
    await expect(page.getByText(emp("createSuccess"))).toBeVisible();

    await page.getByPlaceholder(emp("searchPlaceholder")).fill(prefix);
    await expect(row(page, name)).toBeVisible();
    await expect(row(page, name)).toContainText("Ayudante");

    await edit(row(page, name)).click();
    await expect(page.getByRole("dialog").getByText(emp("editTitle"), { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").getByPlaceholder(emp("namePlaceholder"))).toHaveValue(name);
    await page.getByRole("dialog").getByPlaceholder(emp("positionPlaceholder")).fill("Encargado");
    await page.getByRole("dialog").getByRole("button", { name: emp("save") }).click();
    await expect(page.getByText(emp("updateSuccess"))).toBeVisible();
    await expect(row(page, name)).toContainText("Encargado");

    // Limpieza: se elimina el empleado de prueba y su usuario.
    await remove(row(page, name)).click();
    await page.getByRole("dialog").getByRole("button", { name: emp("delete"), exact: true }).click();
    await expect(row(page, name)).toHaveCount(0);
  });

  test("[EPL-002] un empleado nuevo creado como Activo aparece Activo @regresion", async ({ page }, info) => {
    const name = `Rosa ${uniquePrefix(info.workerIndex)}`;
    await page.goto("/es/empleados");
    await createEmployee(page, name);
    await page.getByPlaceholder(emp("searchPlaceholder")).fill(name);
    try {
      await expect(row(page, name)).toContainText(emp("active"));
    } finally {
      // No deja el empleado aunque el caso falle.
      await remove(row(page, name)).click();
      await page.getByRole("dialog").getByRole("button", { name: emp("delete"), exact: true }).click();
      await expect(page.getByText(emp("deleteSuccess"))).toBeVisible();
    }
  });
});

test.describe("admin de Volta", () => {
  test.use({ storageState: storageStatePath("admin", "volta.demo") });

  test("[EPL-016] activa, desactiva y elimina un empleado, con confirmación @regresion", async ({ page }, info) => {
    const name = `Luisa ${uniquePrefix(info.workerIndex)}`;
    await page.goto("/es/empleados");
    await createEmployee(page, name);
    await page.getByPlaceholder(emp("searchPlaceholder")).fill(name);
    const target = row(page, name);
    await expect(target).toBeVisible();

    // Nace inactivo (sin correo, se activa a mano): el interruptor lo activa y lo desactiva.
    const toggle = target.getByRole("switch");
    if (await toggle.isChecked()) await toggle.click();
    await expect(target).toContainText(emp("inactive"));
    await toggle.click();
    await expect(page.getByText(emp("activateSuccess"))).toBeVisible();
    await expect(target).toContainText(emp("active"));
    await toggle.click();
    await expect(page.getByText(emp("deactivateSuccess"))).toBeVisible();

    // Cancelar el diálogo no borra; confirmarlo, sí.
    await remove(target).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(emp("deleteTitle"))).toBeVisible();
    await expect(dialog.getByText(emp("deleteConfirm", { name }))).toBeVisible();
    await dialog.getByRole("button", { name: emp("cancel") }).click();
    await expect(target).toBeVisible();
    await remove(target).click();
    await page.getByRole("dialog").getByRole("button", { name: emp("delete"), exact: true }).click();
    await expect(page.getByText(emp("deleteSuccess"))).toBeVisible();
    await expect(target).toHaveCount(0);
  });
});
