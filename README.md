# draxuvo-ui

Panel del ERP **Draxuvo**. Next.js 16 (App Router), TypeScript, Tailwind CSS v4 y shadcn/ui, en español e inglés con next-intl. Consume [draxuvo-api](https://github.com/Draxuvo/draxuvo-api). Parte del [workspace Draxuvo](https://github.com/bothi3119/bothi).

## Qué trae

Pantallas por rol, todas bajo `src/app/[locale]/` con rutas en español:

| Quién | Pantallas |
|---|---|
| Dueño, administrador, gerente | `/inicio`, `/dashboard`, `/empleados`, `/asistencia`, `/inventario`, `/ordenes`, `/tickets`, `/reportes`, `/equipo`, `/mis-empresas`, `/suscripcion`, `/perfil` |
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
