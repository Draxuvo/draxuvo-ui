import { expect, test } from "@playwright/test";
import { knownFailure } from "../../support/known-failure";
import { storageStatePath } from "../../support/session";

const ANON = { cookies: [], origins: [] };
const PROTECTED = [
  "inicio",
  "dashboard",
  "empleados",
  "inventario",
  "ordenes",
  "tickets",
  "reportes",
  "suscripcion",
  "empresas",
  "mis-ordenes",
];
const PUBLIC = ["login", "registro", "recuperar-contrasena", "set-password"];

test.describe("sin sesión", () => {
  test.use({ storageState: ANON });

  for (const locale of ["es", "en"]) {
    test(`[AUT-026] las rutas del panel van al login (${locale}) @pr`, async ({ page }) => {
      for (const route of PROTECTED) {
        await page.goto(`/${locale}/${route}`);
        await expect(page, route).toHaveURL(new RegExp(`/${locale}/login$`));
      }
    });

    test(`[AUT-026] las rutas públicas se muestran sin redirección (${locale}) @pr`, async ({ page }) => {
      for (const route of PUBLIC) {
        await page.goto(`/${locale}/${route}`);
        await expect(page, route).toHaveURL(new RegExp(`/${locale}/${route}$`));
      }
    });
  }
});

test.describe("admin con sesión", () => {
  test.use({ storageState: storageStatePath("admin", "volta.demo") });

  test("[AUT-027] las rutas públicas llevan al inicio, salvo set-password @regresion", async ({ page }) => {
    for (const route of ["login", "registro", "recuperar-contrasena"]) {
      await page.goto(`/es/${route}`);
      await expect(page, route).toHaveURL(/\/es\/inicio$/);
    }
    await page.goto("/es/set-password?token=x");
    await expect(page).toHaveURL(/\/es\/set-password/);
  });
});

test.describe("staff con sesión", () => {
  test.use({ storageState: storageStatePath("staff", "volta.demo") });

  const ADMIN_ROUTES = [
    "inicio",
    "dashboard",
    "empleados",
    "asistencia",
    "inventario",
    "ordenes",
    "ordenes/1",
    "tickets",
    "equipo",
    "mis-empresas",
  ];

  for (const locale of ["es", "en"]) {
    test(`[VEM-003] las rutas de administración van a mis-ordenes (${locale}) @pr`, async ({ page }) => {
      for (const route of ADMIN_ROUTES) {
        await page.goto(`/${locale}/${route}`);
        await expect(page, route).toHaveURL(new RegExp(`/${locale}/mis-ordenes$`));
      }
    });
  }

  test("[VEM-003] reportes, suscripción y pantallas de super admin también redirigen @regresion", async ({ page }) => {
    knownFailure("H-06");
    for (const route of ["reportes", "suscripcion", "empresas", "usuarios", "suscripciones", "estadisticas"]) {
      await page.goto(`/es/${route}`);
      await expect(page, route).toHaveURL(/\/es\/mis-ordenes$/);
    }
  });
});
