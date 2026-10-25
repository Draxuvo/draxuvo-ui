# draxuvo-ui

Panel del ERP **Draxuvo**. Next.js 16 (App Router), TypeScript, Tailwind CSS v4 y shadcn/ui, en español e inglés con next-intl. Consume [draxuvo-api](https://github.com/Draxuvo/draxuvo-api). Parte del [workspace Draxuvo](https://github.com/bothi3119/bothi).

## Qué trae

Pantallas por rol, todas bajo `src/app/[locale]/` con rutas en español:

| Quién | Pantallas |
|---|---|
| Dueño, administrador | `/inicio`, `/dashboard`, `/empleados`, `/asistencia`, `/inventario`, `/ordenes`, `/tickets`, `/reportes`, `/equipo`, `/mis-empresas`, `/suscripcion`, `/perfil` |
| Super admin | `/empresas`, `/usuarios`, `/suscripciones`, `/estadisticas` |
| Staff | `/mis-ordenes`, `/mis-tickets`, `/mi-perfil` |
| Sin sesión | `/login`, `/registro`, `/recuperar-contrasena`, `/set-password` |

`src/proxy.ts` redirige según la sesión y el rol. El menú solo muestra lo que permiten el rol y los módulos del plan de la empresa activa.

## Empezar

Requiere Node 22 y la API en `http://localhost:3000`.

```bash
npm ci
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > .env.local
npm run dev     # http://localhost:4200
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | Desarrollo, compilación y servidor de producción (puerto 4200) |
| `npm run lint` | ESLint con `--max-warnings 0` |
| `npm test` | Vitest, jsdom y Testing Library |
| `npm run e2e:pr` | Pruebas de recorrido de Playwright, suite de PR |
| `npm run e2e:regresion` | Playwright, todo menos `@flaky` |
| `npm run e2e:map` | Regenera el mapa de cobertura del plan de pruebas |

Las pruebas unitarias viven junto al código (`*.test.ts(x)`). Las de recorrido están en `e2e/`; necesitan la API en `:3000` con los datos de demo y la UI construida en `:4200`. Guía en [`e2e/README.md`](e2e/README.md).

## CI

`.github/workflows/ci.yml` corre lint, tipos, pruebas, compilación y el job `e2e` (levanta Postgres, la API y esta UI). `e2e-regresion.yml` corre la suite completa cada noche a las 3:00 (hora de Ciudad de México) y bajo demanda.

## Más información

[`CLAUDE.md`](CLAUDE.md) y [`AGENTS.md`](AGENTS.md) describen la arquitectura y los patrones. El diseño sale de `DESIGN.md` en la raíz del workspace.

## Despliegue a producción (Cloudflare Workers)

Producción: **https://app.draxuvo.com** (Worker `draxuvo-ui`, plan gratuito). Spec: `specs/012-deploy-produccion/` del workspace.

- **Automático**: cada push a `main` con el CI en verde ejecuta el job `deploy` de `.github/workflows/ci.yml`
  (`npm run deploy:vinext`). Secretos del repo: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- **Variables de build** (se fijan al compilar, no en tiempo de ejecución): `NEXT_PUBLIC_API_URL=https://api.draxuvo.com`.
- **Manual**: `NEXT_PUBLIC_API_URL=https://api.draxuvo.com npm run deploy:vinext` (compila con vinext y despliega con `cf`; requiere `cf auth login` o `CLOUDFLARE_API_TOKEN`).
  Para validar sin desplegar: `npx vinext-cloudflare deploy --dry-run`.
- **Local con el runtime de Workers**: `npm run build:vinext && npx vite preview` (el desarrollo diario sigue siendo `npm run dev`).
- **Reversa**: `npx wrangler rollback --name draxuvo-ui` (vuelve a la versión anterior; con un ID de versión, a esa) o, desde el panel de Cloudflare, Workers → `draxuvo-ui` → Deployments → Rollback. No revierte los recursos enlazados (KV). Objetivo: < 15 min.
- **Configuración**: `cloudflare.config.ts` (nombre, dominio personalizado y bindings) y `vite.config.ts`.
- Los recorridos Playwright (`e2e/`) siguen corriendo en el CI contra una API local; no se ejecutan contra producción.
