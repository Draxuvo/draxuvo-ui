# Pruebas e2e con Playwright

Automatizan los casos `playwright` y los flujos de `specs/009-plan-pruebas-regresion/plan-pruebas/`. Cada prueba lleva el id del caso en el título (`[AUT-026] ...`) y una etiqueta de suite: `@pr` o `@regresion`.

## Correr en local

Necesitas la API en `:3000` con los datos de demo (`bin/rails db:reset` en `draxuvo-api`) y la UI en `:4200`. Para pruebas estables usa la UI construida:

```bash
npm run build && npx next start -p 4200     # en otra terminal; con `npm run dev` las rutas compilan al vuelo y van lentas
npx playwright install chromium             # una sola vez

npm run e2e:pr          # suite de PR: casos @pr
npm run e2e:regresion   # todo menos @flaky
npm run e2e:map         # regenera 31-cobertura-playwright.md en el plan 009
```

Variables:

| Variable | Para qué |
|---|---|
| `E2E_API_URL` / `E2E_UI_URL` | por defecto `http://localhost:3000` y `http://localhost:4200` |
| `SECRET_KEY_BASE` | la misma de la API; firma los enlaces de contraseña (no hay correo real) |
| `SUPER_ADMIN_PASSWORD` | la del super admin de tu base local; por defecto `SuperAdmin12345*` |
| `STRIPE_WEBHOOK_SECRET` | el mismo que usa la API; firma los webhooks simulados |

La API debe arrancar con `REGISTRATION_RATE_LIMIT=1000`: varias pruebas crean empresas y el tope normal es 5 por hora por IP. Lo mismo con las demos (spec 039): `DEMO_RATE_LIMIT=1000` y `DEMO_MAX_PROVISIONING=10`, porque los e2e abren varias a la vez desde la misma IP; `e2e/ci/up.sh` ya los exporta.

## Cómo está organizado

- `e2e/global-setup.ts` inicia sesión por API una vez por rol y empresa y guarda `e2e/.auth/<rol>-<dominio>.json`.
- `e2e/support/` guarda los ayudantes: sesión, datos (`uniquePrefix`, `createCompany`), tokens, Stripe simulado, `knownFailure`, `t()` sobre `messages/es.json` y el reporter.
- `e2e/tests/` tiene las pruebas, por área.
- `e2e/ci/up.sh` levanta la base, la API y la UI; lo usan los CI de `ui` y de `api`.

Reglas: toda prueba que crea datos usa `uniquePrefix`; las que cambian plan, módulos, modo de órdenes o miembros crean una empresa nueva; ninguna cambia la contraseña ni el rol de los usuarios demo; los terceros (Stripe, correo, WhatsApp) se simulan.

## Fallos conocidos e inestables

- Una prueba que falla por un hallazgo del plan (`H-01` a `H-99`, en `40-criterios-salida.md`) llama `knownFailure("H-xx")`. Si el hallazgo se corrige y la prueba pasa, la corrida falla y pide quitar la marca.
- Una prueba que falla y pasa al reintentar sale como inestable. Dos veces en una semana: se marca `@flaky`, sale de la suite `pr` y tiene 14 días para arreglarse o borrarse. Un `P0` inestable bloquea el PR; no se marca `@flaky`.

## CI

- Cada PR de `draxuvo-ui` y de `draxuvo-api` corre el job `e2e` (suite `pr`). Cada uno descarga el otro repo en la rama con el mismo nombre, o en `main`.
- `e2e-regresion.yml` corre toda la suite de noche y bajo demanda (Actions → e2e-regresion → Run workflow).
- Informe, trazas y registros de la API se guardan 14 días en el artefacto `playwright-report`.

### Pasos que no son código

1. Marcar el check `e2e` como obligatorio en la protección de la rama `main` de `draxuvo-ui` y de `draxuvo-api` (Settings → Branches). Sin eso un PR en rojo se puede fusionar.
2. Si los repos son privados, crear el secret `E2E_REPO_TOKEN` en ambos (token con lectura del otro repo).
