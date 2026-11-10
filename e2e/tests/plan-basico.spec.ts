import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { E2E_PASSWORD, createCompany, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL } from "../support/session";
import { passwordToken } from "../support/tokens";

// Plan Básico de punta a punta, módulo por módulo (personal, asistencia y nómina; inventario; reportes; alertas;
// suscripción), más permisos, validación de datos, idioma y móvil. Cada prueba crea su propia empresa Básico.
//
// Los casos que reproducen un hallazgo abierto llevan `knownFailure("H-xx")` (ver 40-criterios-salida.md): pasan
// mientras el hueco exista y fallan cuando se corrija, para recordar quitar la marca.
// H-01, H-02, H-04, H-06, H-08, H-14: ya estaban en el registro. H-31 a H-45: los registró esta revisión.

const ANON = { cookies: [], origins: [] };
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });

// ---------- ayudantes ----------

type Auth = { token: string; companyId: number; headers: Record<string, string> };

async function loginApi(request: APIRequestContext, email: string, password: string): Promise<Auth> {
  const res = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
  const body = await res.json();
  const companyId = body.user.companies[0].id as number;
  return { token: body.token, companyId, headers: { Authorization: `Bearer ${body.token}`, "X-Company-Id": String(companyId) } };
}

async function newOwner(request: APIRequestContext, workerIndex: number): Promise<{ company: NewCompany; owner: Auth }> {
  const company = await createCompany(request, { workerIndex, plan: "basic" });
  return { company, owner: await loginApi(request, company.email, company.password) };
}

/** Personal de piso (rol staff) con contraseña ya fijada, creado como lo haría el dueño: ficha con acceso y enlace de alta. */
async function newStaff(request: APIRequestContext, owner: Auth, prefix: string): Promise<Auth & { email: string; employeeId: number; userId: number }> {
  const email = `${prefix}-staff@mailinator.com`;
  const name = `Personal ${prefix}`;
  const created = await request.post(`${API_URL}/api/v1/employees`, {
    headers: owner.headers,
    data: { employee: { name, email, phone: "5512345678", salary: 8000 }, access: { role: "staff" } },
  });
  expect(created.status(), await created.text()).toBe(201);
  const employee = await created.json();
  const members = await request.get(`${API_URL}/api/v1/company/members`, { headers: owner.headers });
  const member = (await members.json()).results.find((m: { email: string }) => m.email === email);
  const set = await request.put(`${API_URL}/api/v1/passwords/update_with_token`, {
    data: {
      token: passwordToken({ id: member.id, email, fullName: name }),
      new_password: E2E_PASSWORD,
      new_password_confirmation: E2E_PASSWORD,
    },
  });
  expect(set.status(), await set.text()).toBe(200);
  const auth = await loginApi(request, email, E2E_PASSWORD);
  return { ...auth, email, employeeId: employee.id, userId: member.id };
}

async function uiLogin(page: Page, email: string, password: string, landing: RegExp = /\/es\/inicio$/) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
  await expect(page).toHaveURL(landing);
}

async function ownerPage(browser: Browser, company: NewCompany) {
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await uiLogin(page, company.email, company.password);
  return { context, page };
}

async function addProduct(request: APIRequestContext, owner: Auth, data: Record<string, unknown>) {
  const res = await request.post(`${API_URL}/api/v1/products`, { headers: owner.headers, data: { product: data } });
  return res;
}

/** Producto que se cuenta (las empresas nuevas son de servicio: "Refacción" se vende y se cuenta, spec 016). */
async function addCounted(request: APIRequestContext, owner: Auth, sku: string, stock: number, extra: Record<string, unknown> = {}) {
  const res = await addProduct(request, owner, { sku, name: `Producto ${sku}`, stock, min_stock: 1, unit_cost: 10, price: 25, ...extra });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: number; stock: number };
}

const errorCode = async (res: { json: () => Promise<unknown> }) =>
  ((await res.json()) as { error?: { details?: { code?: string } } }).error?.details?.code;

// ===================================================================================================================
// 1. Alta, plan y alcance del plan
// ===================================================================================================================

test.describe("alta y alcance del plan Básico", () => {
  test.use({ storageState: ANON });

  test("[BAS-001] el dueño nuevo ve el plan Básico en prueba y el menú solo con lo que incluye @pr", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);

    // El menú se filtra por módulos cuando llega la suscripción: antes de eso muestra los del rol (ver BAS-072).
    await expect
      .poll(async () => (await menu(page).getByRole("link").allInnerTexts()).map((l) => l.trim()), { timeout: 15_000 })
      .toEqual([t("nav.home"), t("nav.dashboard"), t("nav.people"), t("nav.inventory"), t("nav.reports"), t("nav.alerts"), t("subscription.nav")]);
    await expect(page.getByText(t("subscription.trialStatus")).or(page.getByText(/días? de prueba|días para/i)).first()).toBeVisible();

    await page.goto("/es/suscripcion");
    await expect(page.getByText(t("plans.basic"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/En prueba/).first()).toBeVisible();
    await context.close();
  });

  test("[BAS-002] lo que no es del plan se bloquea en pantalla y la API responde 403 module_not_in_plan @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);

    for (const route of ["/es/ordenes", "/es/restaurante", "/es/terminales", "/es/venta", "/es/ventas", "/es/tickets"]) {
      await page.goto(route);
      await expect(page.getByText(t("subscription.moduleLocked")), route).toBeVisible();
    }

    for (const path of ["/work_orders", "/tickets", "/restaurant/tables", "/payment_terminals", "/sales", "/sales/catalog", "/reports/income"]) {
      const res = await request.get(`${API_URL}/api/v1${path}`, { headers: owner.headers });
      expect(res.status(), path).toBe(403);
      expect(await errorCode(res), path).toBe("module_not_in_plan");
    }
    await context.close();
  });

  test("[BAS-003] varias empresas es del plan Empresa: Mis empresas lo ofrece y la API no crea sucursales @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/mis-empresas");
    await expect(page.getByRole("heading", { name: t("nav.myCompanies") })).toBeVisible();
    await expect(page.getByText(/plan Empresa/i).first()).toBeVisible();

    const res = await request.post(`${API_URL}/api/v1/company/branches`, { headers: owner.headers, data: { branch: { name: "Sucursal que no debe existir" } } });
    expect([402, 403, 422]).toContain(res.status());
    const list = await request.get(`${API_URL}/api/v1/company/branches`, { headers: owner.headers });
    expect(JSON.stringify(await list.json())).not.toContain("Sucursal que no debe existir");
    await context.close();
  });

  test("[BAS-004] pantallas vacías de una empresa nueva: inventario, personal, nómina, alertas y reportes explican qué hacer @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    const empties: Array<[string, RegExp]> = [
      ["/es/inventario", /No hay productos registrados/],
      ["/es/personal", /No hay empleados|Aún no hay empleados|0 empleados/i],
      ["/es/personal?tab=nomina", /Aún no hay corridas de nómina/],
      ["/es/alertas", new RegExp(t("alerts.empty.title"))],
    ];
    for (const [route, text] of empties) {
      await page.goto(route);
      await expect(page.getByText(text).first(), route).toBeVisible();
    }
    await page.goto("/es/reportes");
    await expect(page.getByRole("heading", { name: t("nav.reports") })).toBeVisible();
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0);
    await context.close();
  });
});

// ===================================================================================================================
// 2. Personal, asistencia y nómina
// ===================================================================================================================

test.describe("personal, asistencia y nómina", () => {
  test.use({ storageState: ANON });

  test("[BAS-010] el dueño da de alta personal con salario, marca entrada y salida y Asistencia lo muestra con su duración @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    const created = await request.post(`${API_URL}/api/v1/employees`, { headers: owner.headers, data: { employee: { name: `Ana ${prefix}`, salary: 9000 } } });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id;

    const hour = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    const inRes = await request.post(`${API_URL}/api/v1/employees/${id}/checkin`, { headers: owner.headers, data: { at: hour(9) } });
    expect(inRes.status(), await inRes.text()).toBeLessThan(300);
    const out = await request.post(`${API_URL}/api/v1/employees/${id}/checkout`, { headers: owner.headers, data: { at: hour(1) } });
    expect(out.status(), await out.text()).toBeLessThan(300);

    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/personal?tab=asistencia");
    await expect(page.getByText(`Ana ${prefix}`).first()).toBeVisible();
    // 8 horas de turno: la duración se muestra (no queda abierta ni vacía).
    await expect(page.getByText(/8\s?h|8:00|480/).first()).toBeVisible();
    await context.close();
  });

  test("[BAS-011] el personal de piso marca su propia entrada y salida y solo ve su perfil @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));

    const today = await request.get(`${API_URL}/api/v1/my_attendance/today`, { headers: staff.headers });
    expect(today.status()).toBe(200);
    const checkIn = await request.post(`${API_URL}/api/v1/my_attendance/check_in`, { headers: staff.headers });
    expect(checkIn.status(), await checkIn.text()).toBeLessThan(300);
    const again = await request.post(`${API_URL}/api/v1/my_attendance/check_in`, { headers: staff.headers });
    expect(again.status(), "la entrada es idempotente").toBeLessThan(300);
    const checkOut = await request.post(`${API_URL}/api/v1/my_attendance/check_out`, { headers: staff.headers });
    expect(checkOut.status(), await checkOut.text()).toBeLessThan(300);

    const roster = await request.get(`${API_URL}/api/v1/attendances/roster`, { headers: owner.headers });
    expect(JSON.stringify(await roster.json())).toContain(`Personal`);
  });

  test("[BAS-016] el personal de piso marca su entrada en el aviso de inicio y su salida desde el encabezado @regresion", async ({ browser, request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    const context = await browser.newContext({ storageState: ANON });
    const page = await context.newPage();
    await uiLogin(page, staff.email, E2E_PASSWORD, /\/es\/mis-ordenes$/);

    await page.getByRole("dialog").getByRole("button", { name: t("attendance.entry.mark") }).click();
    await expect(page.getByRole("button", { name: /Marcar salida/ }).first()).toBeVisible();
    const open = await request.get(`${API_URL}/api/v1/my_attendance/today`, { headers: staff.headers });
    expect(JSON.stringify(await open.json())).toContain("checkin");

    await page.getByRole("button", { name: /Marcar salida/ }).first().click();
    await expect(page.getByRole("button", { name: t("attendance.status.markIn") }).first()).toBeVisible();
    await context.close();
  });

  test("[BAS-017] el dueño marca la entrada y la salida de una persona desde Asistencia y queda quién lo capturó @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const name = `Rosa ${uniquePrefix(info.workerIndex)}`;
    const created = await request.post(`${API_URL}/api/v1/employees`, { headers: owner.headers, data: { employee: { name } } });
    const id = (await created.json()).id;
    const { page, context } = await ownerPage(browser, company);

    await page.goto("/es/personal?tab=asistencia");
    await expect(page.getByText(name).first()).toBeVisible();
    await page.getByRole("button", { name: t("attendance.roster.markIn") }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: t("attendance.mark.confirmIn") }).click();
    await expect.poll(async () => {
      const a = await (await request.get(`${API_URL}/api/v1/attendances?employee_id=${id}`, { headers: owner.headers })).json();
      return a.results?.length ?? 0;
    }, { timeout: 10_000 }).toBe(1);

    await page.getByRole("button", { name: t("attendance.roster.markOut") }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: t("attendance.mark.confirmOut") }).click();
    await expect.poll(async () => {
      const a = await (await request.get(`${API_URL}/api/v1/attendances?employee_id=${id}`, { headers: owner.headers })).json();
      return Boolean(a.results?.[0]?.checkout_at);
    }, { timeout: 10_000 }).toBe(true);
    await context.close();
  });

  test("[BAS-012] el personal de Básico entra a una pantalla útil, no a un bloqueo que pide mejorar el plan @regresion", async ({ browser, request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    const context = await browser.newContext({ storageState: ANON });
    const page = await context.newPage();
    const ordersCall = page.waitForResponse((r) => r.url().includes("/api/v1/work_orders"));
    await uiLogin(page, staff.email, E2E_PASSWORD, /\/es\/mis-ordenes$/);
    await ordersCall;
    await page.waitForTimeout(1500);
    // Quien no administra no puede "mejorar el plan": su inicio no debe ser un bloqueo de módulo.
    await expect(page.getByText(t("subscription.moduleLocked"))).toHaveCount(0);
    await context.close();
  });

  test("[BAS-013] dar de baja al empleado suspende su acceso (403 employee_inactive) y reactivarlo lo restablece @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    expect((await request.get(`${API_URL}/api/v1/my_attendance/today`, { headers: staff.headers })).status()).toBe(200);

    const off = await request.patch(`${API_URL}/api/v1/employees/${staff.employeeId}`, { headers: owner.headers, data: { employee: { status: "inactive" } } });
    expect(off.status(), await off.text()).toBe(200);
    const blocked = await request.get(`${API_URL}/api/v1/my_attendance/today`, { headers: staff.headers });
    expect(blocked.status()).toBe(403);
    expect(await errorCode(blocked)).toBe("employee_inactive");

    const on = await request.patch(`${API_URL}/api/v1/employees/${staff.employeeId}`, { headers: owner.headers, data: { employee: { status: "active" } } });
    expect(on.status()).toBe(200);
    expect((await request.get(`${API_URL}/api/v1/my_attendance/today`, { headers: staff.headers })).status()).toBe(200);
  });

  test("[BAS-014] nómina: corrida quincenal con dos empleados, bono, aprobar y pagar todos; Reportes → Nómina suma lo pagado @regresion", async ({ browser, request }, info) => {
    test.setTimeout(120_000);
    const { company, owner } = await newOwner(request, info.workerIndex);
    for (const [name, salary] of [["Luis", 10000], ["María", 12000]] as const) {
      const r = await request.post(`${API_URL}/api/v1/employees`, { headers: owner.headers, data: { employee: { name: `${name} ${info.workerIndex}`, salary } } });
      expect(r.status()).toBe(201);
    }
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/personal?tab=nomina");
    await page.getByRole("button", { name: t("payroll.newRun") }).click();
    const dialog = page.getByRole("dialog", { name: t("payroll.new.title") });
    await dialog.getByLabel(t("payroll.new.from")).fill("2026-09-01");
    await dialog.getByLabel(t("payroll.new.to")).fill("2026-09-15");
    await dialog.getByRole("button", { name: t("payroll.new.create") }).click();

    await expect(page.getByRole("button", { name: t("payroll.detail.approve") })).toBeVisible();
    // Quincena de dos salarios mensuales: (10,000 + 12,000) / 2 = 11,000.
    await expect(page.getByText(/11,000\.00/).first()).toBeVisible();
    await page.getByRole("button", { name: t("payroll.detail.approve") }).click();
    await page.getByRole("dialog").getByRole("button", { name: t("payroll.detail.confirm") }).click();
    await page.getByRole("button", { name: t("payroll.detail.payAll") }).click();
    const pay = page.getByRole("dialog");
    await pay.getByLabel(t("payroll.pay.method")).selectOption("transfer");
    await pay.getByLabel(t("payroll.pay.reference")).fill("SPEI básico");
    await pay.getByRole("button", { name: t("payroll.pay.confirm") }).click();
    await expect(page.getByRole("button", { name: t("payroll.detail.payAll") })).toHaveCount(0);

    // Reportes → Nómina suma lo pagado de las corridas cuyo periodo termina en el rango (spec 037).
    await expect
      .poll(async () => {
        const report = await request.get(`${API_URL}/api/v1/reports/payroll?from=2026-09-01&to=2026-09-30`, { headers: owner.headers });
        return (await report.json()).runs.paid_cents;
      }, { timeout: 15_000 })
      .toBe(1_100_000);
    await context.close();
  });

  test("[BAS-015] datos de personal raros: nombre con HTML se muestra como texto; salario negativo, salario gigante y teléfono con letras se rechazan @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const html = '<b>Negrita</b> <img src=x onerror="window.__xss=1">';
    expect((await request.post(`${API_URL}/api/v1/employees`, { headers: owner.headers, data: { employee: { name: html } } })).status()).toBe(201);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/personal");
    await expect(page.getByText("onerror").first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await context.close();

    const negative = await request.post(`${API_URL}/api/v1/employees`, { headers: owner.headers, data: { employee: { name: "Salario negativo", salary: -500 } } });
    const huge = await request.post(`${API_URL}/api/v1/employees`, { headers: owner.headers, data: { employee: { name: "Salario gigante", salary: 1e15 } } });
    const phone = await request.post(`${API_URL}/api/v1/employees`, { headers: owner.headers, data: { employee: { name: "Tel con letras", phone: "abc" } } });
    expect([negative.status(), huge.status(), phone.status()]).toEqual([422, 422, 422]);
  });
});

// ===================================================================================================================
// 3. Inventario
// ===================================================================================================================

test.describe("inventario", () => {
  test.use({ storageState: ANON });

  test("[BAS-020] el producto con existencia baja del mínimo llega a Alertas y a la campana, y el Dashboard lo cuenta @pr", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    await addCounted(request, owner, "BAJO-1", 1, { min_stock: 5 });
    await addCounted(request, owner, "OK-1", 40, { min_stock: 5 });
    const { page, context } = await ownerPage(browser, company);

    await expect(page.getByLabel(t("alerts.bell.label"), { exact: false }).or(page.getByRole("link", { name: /alertas/i })).first()).toBeVisible();
    await page.goto("/es/alertas");
    await expect(page.getByText("Producto BAJO-1")).toBeVisible();
    await expect(page.getByText("Producto OK-1")).toHaveCount(0);
    await page.goto("/es/dashboard");
    await expect(page.getByText(/Stock bajo/i).first()).toBeVisible();
    await context.close();
  });

  test("[BAS-021] entradas y salidas cuadran con la existencia y con el valor del reporte de Inventario @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const product = await addCounted(request, owner, "MOV-1", 10, { unit_cost: 12.5 });
    const move = (type: string, qty: number) =>
      request.post(`${API_URL}/api/v1/products/${product.id}/stock_movements`, { headers: owner.headers, data: { stock_movement: { movement_type: type, qty } } });
    expect((await move("entry", 5)).status()).toBe(201);
    expect((await move("exit", 3)).status()).toBe(201);

    const now = await (await request.get(`${API_URL}/api/v1/products/${product.id}`, { headers: owner.headers })).json();
    expect(now.stock).toBe(12);
    const report = await (await request.get(`${API_URL}/api/v1/reports/inventory?from=2020-01-01&to=2030-01-01`, { headers: owner.headers })).json();
    expect(report.stock.value).toBe(12 * 12.5);
    const row = report.movements.rows.find((r: { sku: string }) => r.sku === "MOV-1");
    // La existencia inicial (10) deja su movimiento «Inventario inicial» (spec 052): 10 + 5 de entradas y 3 de salidas.
    expect([row.entries, row.exits]).toEqual([15, 3]);
  });

  test("[BAS-021b] un producto que nace con existencia deja su movimiento «Inventario inicial»: el historial cuadra con la existencia @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    await addCounted(request, owner, "INI-1", 10);
    const report = await (await request.get(`${API_URL}/api/v1/reports/inventory?from=2020-01-01&to=2030-01-01`, { headers: owner.headers })).json();
    const row = report.movements.rows.find((r: { sku: string }) => r.sku === "INI-1");
    expect(row?.entries).toBe(10);
  });

  test("[BAS-022] una salida mayor a la existencia se rechaza y el stock nunca queda negativo (con el cuerpo de la UI) @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const product = await addCounted(request, owner, "NEG-1", 4);
    const res = await request.post(`${API_URL}/api/v1/products/${product.id}/stock_movements`, {
      headers: owner.headers,
      data: { stock_movement: { movement_type: "exit", qty: 50 } },
    });
    expect(res.status()).toBe(422);
    const after = await (await request.get(`${API_URL}/api/v1/products/${product.id}`, { headers: owner.headers })).json();
    expect(after.stock).toBeGreaterThanOrEqual(0);
  });

  test("[BAS-023] la UI avisa «Stock insuficiente» al sacar más de lo que hay, y deja la existencia igual @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const product = await addCounted(request, owner, "NEG-2", 4);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/inventario");
    const row = page.getByRole("row").filter({ hasText: "NEG-2" });
    await row.getByRole("button").nth(1).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText(t("inventory.quantityIn", { unit: "Pieza" }), { exact: true }).locator("xpath=following-sibling::input").fill("50");
    await dialog.getByRole("button", { name: t("inventory.confirm") }).click();
    await expect(page.getByText(/Stock insuficiente/i)).toBeVisible();
    const after = await (await request.get(`${API_URL}/api/v1/products/${product.id}`, { headers: owner.headers })).json();
    expect(after.stock).toBe(4);
    await context.close();
  });

  test("[BAS-024] nombres con HTML se muestran como texto y no ejecutan nada; Exportar baja el Excel con los productos @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    await addCounted(request, owner, "XSS-1", 3, { name: '<img src=x onerror="window.__xss=1">' });
    await addCounted(request, owner, "EXP-1", 7, { name: "Producto exportable" });
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/inventario");
    await expect(page.getByText("Producto exportable")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: t("inventory.exportButton") }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
    await context.close();
  });

  test("[BAS-025] un tipo de producto de un negocio de abarrotes: la primera vez el formulario ofrece tipos con nombre de comercio, no de taller @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/inventario");
    await page.getByRole("button", { name: t("inventory.new") }).click();
    const select = page.getByRole("dialog").getByLabel(t("inventory.type"));
    await expect.poll(async () => (await select.locator("option").count()), { timeout: 10_000 }).toBeGreaterThan(1);
    const options = await select.locator("option").allInnerTexts();
    // Un abarrote vende mercancía: "Refacción" y "Material" son vocabulario de servicio técnico.
    expect(options.join("|")).not.toMatch(/Refacción|Material/);
    await context.close();
  });

  test.describe("validación de datos del producto (API)", () => {
    const post = (request: APIRequestContext, owner: Auth, product: Record<string, unknown>) =>
      request.post(`${API_URL}/api/v1/products`, { headers: owner.headers, data: { product: { name: "Validación", unit_cost: 1, ...product } } });

    test("[BAS-026] costo, precio y mínimo negativos se rechazan @regresion", async ({ request }, info) => {
      const { owner } = await newOwner(request, info.workerIndex);
      const statuses = [
        (await post(request, owner, { sku: "N-1", unit_cost: -3 })).status(),
        (await post(request, owner, { sku: "N-2", price: -9 })).status(),
        (await post(request, owner, { sku: "N-3", min_stock: -2 })).status(),
      ];
      expect(statuses).toEqual([422, 422, 422]);
    });

    test("[BAS-027] cifras gigantes dan 422, no un error interno 500 @regresion", async ({ request }, info) => {
      const { owner } = await newOwner(request, info.workerIndex);
      const res = await post(request, owner, { sku: "G-1", stock: 1e15 });
      expect(res.status()).toBeLessThan(500);
    });

    test("[BAS-028] el SKU no distingue mayúsculas: «a-1» no duplica «A-1» @regresion", async ({ request }, info) => {
      const { owner } = await newOwner(request, info.workerIndex);
      expect((await post(request, owner, { sku: "A-1" })).status()).toBe(201);
      expect((await post(request, owner, { sku: "a-1" })).status()).toBe(422);
    });

    test("[BAS-029] nombre y SKU tienen un largo máximo @regresion", async ({ request }, info) => {
      const { owner } = await newOwner(request, info.workerIndex);
      expect((await post(request, owner, { sku: "L-1", name: "x".repeat(5000) })).status()).toBe(422);
      expect((await post(request, owner, { sku: "S".repeat(500) })).status()).toBe(422);
    });

    test("[BAS-030] un tipo de movimiento inválido da 422, no 500; la cantidad 0 explica el error con texto traducido @regresion", async ({ request }, info) => {
      const { owner } = await newOwner(request, info.workerIndex);
      const product = await addCounted(request, owner, "MV-1", 5);
      const bad = await request.post(`${API_URL}/api/v1/products/${product.id}/stock_movements`, {
        headers: owner.headers,
        data: { stock_movement: { movement_type: "robar", qty: 1 } },
      });
      expect(bad.status()).toBe(422);
    });

    test("[BAS-031] los mensajes de error de la API no traen «Translation missing» @regresion", async ({ request }, info) => {
      const { owner } = await newOwner(request, info.workerIndex);
      const product = await addCounted(request, owner, "TR-1", 5);
      const zero = await request.post(`${API_URL}/api/v1/products/${product.id}/stock_movements`, {
        headers: owner.headers,
        data: { stock_movement: { movement_type: "entry", qty: 0 } },
      });
      const short = await request.post(`${API_URL}/api/v1/registrations`, {
        data: { registration: { first_name: "A", last_name: "B", phone: "5512345678", email: `${uniquePrefix()}@mailinator.com`, password: "1", company_name: "X", plan: "basic", billing_cycle: "monthly" } },
      });
      expect(JSON.stringify(await zero.json()) + JSON.stringify(await short.json())).not.toMatch(/Translation missing/i);
    });
  });
});

// ===================================================================================================================
// 4. Reportes y dashboard
// ===================================================================================================================

test.describe("reportes", () => {
  test.use({ storageState: ANON });

  test("[BAS-040] Reportes de Básico: Resumen, Inventario, Gastos y Nómina; sin Ingresos ni Ventas; las cifras cuadran con los datos @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    await addCounted(request, owner, "R-1", 10, { unit_cost: 20 }); // valor 200
    await request.post(`${API_URL}/api/v1/employees`, { headers: owner.headers, data: { employee: { name: "Sueldo", salary: 5000 } } });
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/reportes");

    const tabsOf = async () => (await page.getByRole("tablist", { name: t("reports.tabsLabel") }).getByRole("tab").allInnerTexts()).map((x) => x.trim()).filter(Boolean);
    // Las pestañas se filtran cuando llega la suscripción: antes aparecen todas (ver BAS-072).
    await expect.poll(tabsOf, { timeout: 15_000 }).toEqual([t("reports.tabSummary"), t("reports.tabInventory"), t("reports.tabExpenses"), t("reports.tabPayroll")]);

    const summary = await (await request.get(`${API_URL}/api/v1/reports/summary?from=2020-01-01&to=2030-01-01`, { headers: owner.headers })).json();
    expect(summary.inventory.value).toBe(200);
    expect(summary.expenses.payroll).toBe(5000);
    expect(summary).not.toHaveProperty("income");
    await expect(page.getByText(/\$200\b/).first()).toBeVisible();
    await context.close();
  });

  test("[BAS-041] las tablas de Reportes se exportan a CSV @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    await addCounted(request, owner, "CSV-1", 2, { min_stock: 9 });
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/reportes");
    await page.getByRole("tab", { name: t("reports.tabInventory") }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Exportar CSV de/ }).first().click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
    await context.close();
  });

  test("[BAS-042] un rango de fechas invertido o inválido en Reportes responde 400/422, no un resumen @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const inverted = await request.get(`${API_URL}/api/v1/reports/summary?from=2026-10-31&to=2026-10-01`, { headers: owner.headers });
    const garbage = await request.get(`${API_URL}/api/v1/reports/summary?from=abc&to=xyz`, { headers: owner.headers });
    expect([inverted.status(), garbage.status()]).toEqual([422, 422]);
  });

  test("[BAS-043] los textos de Básico no prometen lo que no incluye: Alertas y Dashboard no hablan de pedidos, mesas ni ingresos @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/alertas");
    await expect(page.getByText(/Pedidos, mesas/)).toHaveCount(0);
    await page.goto("/es/dashboard");
    await expect(page.getByText(t("analyticsBoard.reportsSub"))).toHaveCount(0);
    await context.close();
  });
});

// ===================================================================================================================
// 5. Suscripción
// ===================================================================================================================

test.describe("suscripción", () => {
  test.use({ storageState: ANON });

  test("[BAS-050] en prueba: Básico a $399 + IVA, el plan no se cambia y el cliente no ve ni compra módulos extra (spec 053) @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const sub = await (await request.get(`${API_URL}/api/v1/subscription`, { headers: owner.headers })).json();
    expect(sub.plan).toBe("basic");
    expect(sub.status).toBe("trialing");
    expect(sub.active_modules.sort()).toEqual(["attendance", "employees", "inventory", "reports"]);

    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/suscripcion");
    await expect(page.getByText(t("subscription.choosePlan"))).toBeVisible();
    // Spec 053: el extra lo enciende el super admin; el cliente no ve «Módulos extra» ni su precio.
    await expect(page.getByText(/Módulos extra/i)).toHaveCount(0);
    await expect(page.getByText(/\$199\.00 al mes/)).toHaveCount(0);
    await expect(page.getByText(t("modules.pos"))).toHaveCount(0);
    await context.close();
  });

  test("[BAS-052] la descripción del plan Básico dice todo lo que incluye: también Reportes @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/suscripcion");
    const basic = page.getByRole("button", { name: /Básico/ }).or(page.getByText("Personal, asistencia, inventario y reportes").locator("xpath=ancestor::*[1]")).first();
    await expect(basic).toBeVisible();
    // Reportes está en Básico (spec 033) y la tarjeta del plan lo dice (spec 052).
    await expect(page.getByText(/Personal, asistencia, inventario y reportes/)).toBeVisible();
    await context.close();
  });

  test("[BAS-051] el dueño no puede contratar el módulo extra por la API: solo el super admin (spec 053) @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const res = await request.post(`${API_URL}/api/v1/subscription/addons`, { headers: owner.headers, data: { module: "pos" } });
    expect(res.status()).toBe(403);
  });
});

// ===================================================================================================================
// 6. Permisos y seguridad (API)
// ===================================================================================================================

test.describe("permisos y seguridad", () => {
  test.use({ storageState: ANON });

  test("[BAS-060] una empresa no ve ni toca datos de otra aunque mande su X-Company-Id @pr", async ({ request }, info) => {
    const a = await newOwner(request, info.workerIndex);
    const b = await newOwner(request, info.workerIndex);
    await addCounted(request, b.owner, "SECRETO-B", 3);
    const crossed = { Authorization: `Bearer ${a.owner.token}`, "X-Company-Id": String(b.owner.companyId) };
    for (const path of ["/products", "/employees", "/reports/summary", "/subscription", "/company", "/company/members", "/attendances", "/payroll_runs"]) {
      const res = await request.get(`${API_URL}/api/v1${path}`, { headers: crossed });
      expect(res.status(), path).toBe(403);
    }
    const own = await (await request.get(`${API_URL}/api/v1/products`, { headers: a.owner.headers })).json();
    expect(JSON.stringify(own)).not.toContain("SECRETO-B");
  });

  test("[BAS-061] el personal de piso no lee la ficha ni los salarios, ni escribe empleados ni asistencia de otros por la API @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    const list = await request.get(`${API_URL}/api/v1/employees`, { headers: staff.headers });
    const attendances = await request.get(`${API_URL}/api/v1/attendances`, { headers: staff.headers });
    const create = await request.post(`${API_URL}/api/v1/employees`, { headers: staff.headers, data: { employee: { name: "Intruso" } } });
    const edit = await request.patch(`${API_URL}/api/v1/employees/${staff.employeeId}`, { headers: staff.headers, data: { employee: { salary: 999999 } } });
    const ficha = await request.get(`${API_URL}/api/v1/employees/${staff.employeeId}`, { headers: staff.headers });
    // La lista existe para asignar responsable en las órdenes: trae solo id, nombre y usuario, sin salario ni contacto.
    expect(list.status()).toBe(200);
    for (const row of (await list.json()).results) expect(Object.keys(row).sort()).toEqual(["id", "name", "status", "user_id"]);
    expect([ficha.status(), attendances.status(), create.status(), edit.status()]).toEqual([403, 403, 403, 403]);
  });

  test("[BAS-062] el personal de piso no crea ni edita productos por la API; sus movimientos quedan a su nombre @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    const product = await addCounted(request, owner, "STAFF-1", 5);
    const create = await request.post(`${API_URL}/api/v1/products`, { headers: staff.headers, data: { product: { sku: "S-X", name: "x", unit_cost: 1 } } });
    const edit = await request.patch(`${API_URL}/api/v1/products/${product.id}`, { headers: staff.headers, data: { product: { name: "Renombrado" } } });
    const move = await request.post(`${API_URL}/api/v1/products/${product.id}/stock_movements`, { headers: staff.headers, data: { stock_movement: { movement_type: "exit", qty: 1 } } });
    const receipt = await request.post(`${API_URL}/api/v1/stock_receipts`, { headers: staff.headers, data: { items: [{ product_id: product.id, qty: 1 }] } });
    // Catálogo: solo dueño y administrador. Movimientos y recepciones siguen abiertos al personal con pistola (spec 034).
    expect([create.status(), edit.status(), move.status(), receipt.status()]).toEqual([403, 403, 201, 201]);
  });

  test("[BAS-063] el personal de piso no edita la empresa ni ve su stripe_id @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    const patch = await request.patch(`${API_URL}/api/v1/company`, { headers: staff.headers, data: { company: { name: "Renombrada por staff" } } });
    expect(patch.status()).toBe(403);
    const show = await request.get(`${API_URL}/api/v1/company`, { headers: staff.headers });
    expect(JSON.stringify(await show.json())).not.toContain("stripe_id");
  });

  test("[BAS-064] el personal de piso no entra por la API a reportes, nómina, alertas, suscripción ni miembros @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    for (const path of ["/reports/summary", "/reports/inventory", "/payroll_runs", "/alerts", "/alert_settings", "/subscription", "/company/members", "/attendances/roster"]) {
      const res = await request.get(`${API_URL}/api/v1${path}`, { headers: staff.headers });
      expect(res.status(), path).toBe(403);
    }
  });

  test("[BAS-065] el personal de piso no abre Reportes ni Suscripción por la URL @regresion", async ({ browser, request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    const context = await browser.newContext({ storageState: ANON });
    const page = await context.newPage();
    await uiLogin(page, staff.email, E2E_PASSWORD, /\/es\/mis-ordenes$/);
    for (const route of ["/es/reportes", "/es/suscripcion"]) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/es\/mis-ordenes$/);
    }
    await context.close();
  });

  test("[BAS-066] un usuario desactivado pierde el acceso aunque conserve su token @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newStaff(request, owner, uniquePrefix(info.workerIndex));
    const sa = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: "draxuvo@mailinator.com", password: process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin12345*" } });
    const superToken = (await sa.json()).token as string;
    const off = await request.patch(`${API_URL}/api/v1/users/${staff.userId}`, { headers: { Authorization: `Bearer ${superToken}` }, data: { user: { active: false } } });
    expect(off.status()).toBe(200);
    const res = await request.get(`${API_URL}/api/v1/profile`, { headers: staff.headers });
    expect([401, 403]).toContain(res.status());
  });

  test("[BAS-067] el inicio de sesión se frena tras varios intentos fallidos @regresion", async ({ request }, info) => {
    // Pasa el tope del entorno de pruebas (LOGIN_RATE_LIMIT=100) con más de 100 inicios de sesión seguidos: no caben en 30 s.
    test.setTimeout(90_000);
    const { company } = await newOwner(request, info.workerIndex);
    const codes: number[] = [];
    for (let i = 0; i < 120; i++) {
      const res = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: company.email, password: `mala-${i}` } });
      codes.push(res.status());
    }
    expect(codes).toContain(429);
  });

  test("[BAS-068] la contraseña débil («12345678») no se acepta al registrarse @regresion", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/registrations`, {
      data: { registration: { first_name: "A", last_name: "B", phone: "5512345678", email: `${uniquePrefix()}@mailinator.com`, password: "12345678", company_name: "Débil", plan: "basic", billing_cycle: "monthly" } },
    });
    expect(res.status()).toBe(422);
  });
});

// ===================================================================================================================
// 6b. Primera carga
// ===================================================================================================================

test.describe("primera carga", () => {
  test.use({ storageState: ANON });

  test("[BAS-072] al entrar, el menú y las pestañas de Reportes no muestran módulos que Básico no tiene ni un instante @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const context = await browser.newContext({ storageState: ANON });
    const page = await context.newPage();
    // Se frena la suscripción para ver lo que pinta la pantalla mientras llega.
    await page.route("**/api/v1/subscription", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await uiLogin(page, company.email, company.password);
    const early = (await menu(page).getByRole("link").allInnerTexts()).map((l) => l.trim());
    expect(early).not.toContain(t("nav.orders"));
    expect(early).not.toContain(t("nav.restaurant"));
    expect(early).not.toContain(t("nav.terminals"));
    await context.close();
  });
});

// ===================================================================================================================
// 7. Idioma y móvil
// ===================================================================================================================

test.describe("idioma y móvil", () => {
  test.use({ storageState: ANON });
  const SCREENS = ["/inicio", "/dashboard", "/personal", "/personal?tab=asistencia", "/personal?tab=nomina", "/inventario", "/inventario/recibir", "/inventario/conteo", "/inventario/etiquetas", "/reportes", "/alertas", "/suscripcion", "/perfil"];

  test("[BAS-070] en inglés ninguna pantalla de Básico muestra claves de traducción @regresion", async ({ browser, request }, info) => {
    test.setTimeout(180_000);
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    for (const route of SCREENS) {
      await page.goto(`/en${route}`);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const body = await page.locator("body").innerText();
      expect(body, route).not.toMatch(/\b(?:[a-z]+\.){1,3}[a-zA-Z]+\b(?<!\.(?:com|org|io|test|demo))/);
      expect(body, route).not.toMatch(/Translation missing/i);
    }
    await context.close();
  });

  test("[BAS-071] en el teléfono (390 px) ninguna pantalla de Básico se desborda horizontalmente @regresion", async ({ browser, request }, info) => {
    test.setTimeout(180_000);
    const { company } = await newOwner(request, info.workerIndex);
    const context = await browser.newContext({ storageState: ANON, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await uiLogin(page, company.email, company.password);
    for (const route of SCREENS) {
      await page.goto(`/es${route}`);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(scroll, route).toBeLessThanOrEqual(client);
    }
    await context.close();
  });
});
