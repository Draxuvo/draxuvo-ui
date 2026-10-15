# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Next.js Version

This project uses **Next.js 16**, which has breaking changes from older versions. Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/` (e.g. `01-app/` for App Router). Heed deprecation notices.

## Commands

```bash
npm run dev      # Dev server on port 4200 (not the default 3000)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint (next/core-web-vitals + typescript), --max-warnings 0
npm test         # Vitest + jsdom + Testing Library (vitest run)
npm run test:watch
npm run e2e:pr         # Playwright, suite de PR (@pr); necesita API :3000 y UI construida :4200
npm run e2e:regresion  # Playwright, todo menos @flaky
npm run e2e:map        # regenera 31-cobertura-playwright.md del plan 009
```

Tests live next to the code (`*.test.ts(x)`); shared helpers in `src/test/` (`setup.ts` stubs what jsdom lacks, `render.tsx` has `renderWithProviders` with the real `messages/es.json`). Mock only the edges (`@/lib/api`, `sonner`, `next/navigation`). CI: `.github/workflows/ci.yml` (lint, typecheck, test, build, e2e). Las pruebas de recorrido con Playwright viven en `e2e/` (no en `src/`); ver `e2e/README.md`. Vitest las ignora.

## Environment Variables

- `NEXT_PUBLIC_API_URL` — backend base URL (`.env.local`: `http://localhost:3000`, `.env.production`: hosted on Render)

## Architecture

**App Router** with locale-based routing via `next-intl`. Every page lives under `src/app/[locale]/`. Route groups divide the app by role:

| Route group | Roles | Layout | Routes (Spanish) |
|---|---|---|---|
| `(auth)` | unauthenticated | none | `/login`, `/recuperar-contrasena`, `/set-password` |
| `(dashboard)` | owner, admin, manager | Sidebar + Header | `/inicio`, `/dashboard`, `/empleados`, `/inventario`, `/ordenes`, `/tickets`, `/suscripcion`, `/perfil` |
| `(super-admin)` | super_admin | SuperAdminSidebar + Header | `/empresas`, `/usuarios`, `/suscripciones`, `/estadisticas` |
| `(employee)` | staff | EmployeeShell | `/mis-ordenes`, `/mis-tickets` |

After login, role-based redirect targets: `super_admin` → `/empresas`, `staff` → `/mis-ordenes`, others → `/inicio`.

**Route paths are in Spanish** — match this convention when adding new routes.

**Middleware** is at `src/proxy.ts` (named proxy, not middleware — intentional). It handles locale routing via `next-intl`, auth redirects based on the `auth_token` cookie, and role-based route blocking (`staff` is hard-redirected away from admin routes).

### Key Directories

```
src/
  app/[locale]/          # All routes under locale prefix
  components/
    ui/                  # shadcn/ui primitives
    layout/              # Shell components (sidebar, header, providers)
    {feature}/           # Feature components (columns.tsx, form, dialogs)
  hooks/                 # use-pagination, use-router (locale-aware), domain hooks
  lib/
    api.ts               # Axios instance + auth/locale/company interceptors
    api-i18n.ts          # Locale resolver for use inside Axios interceptor
    query.ts             # Singleton QueryClient (staleTime 5m, retry 1)
    utils.ts             # cn() = clsx + tailwind-merge
    ticket-pdf.ts        # PDF generation for tickets
  services/              # One file per domain — thin functions over apiClient
  store/auth.ts          # Zustand store with localStorage persist
  types/index.ts         # All shared TypeScript interfaces
  i18n/routing.ts        # Locales: ["es","en"], default: "es"
messages/
  es.json / en.json      # Namespaced translation strings
```

## Tech Stack

| Category | Library |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5, strict |
| Styling | Tailwind CSS v4 (CSS-first config in `globals.css`, no `tailwind.config.ts`) |
| UI Components | shadcn/ui (style: radix-maia) + Radix UI primitives |
| Icons | HugeIcons (`@hugeicons/react`) + lucide-react |
| State | Zustand v5 with `persist` (auth only) |
| Server state | TanStack React Query v5 |
| HTTP | Axios v1 |
| Forms | react-hook-form v7 + Zod v4 + @hookform/resolvers |
| i18n | next-intl v4 |
| Tables | @tanstack/react-table v8 (server-side pagination) |
| Toasts | Sonner v2 |

## Code Patterns

### API Layer
Two-tier pattern:
1. `src/lib/api.ts` — Axios instance. Request interceptor injects `Authorization`, `locale`, and `X-Company-Id` headers. Response interceptor maps HTTP errors to localized Sonner toasts; 401 with token clears storage and redirects to login.
2. `src/services/*.ts` — two coexisting export styles:
   - **Object style**: `export const ticketsService = { list, getById, ... }` — used by most features.
   - **Function style**: `export const getSubscription = () => ...` — used for subscription and companies.
   Match the style already in the file you're editing.
3. Work orders have **no service file** — all API calls and TanStack Query hooks live together in `src/hooks/use-work-orders.ts`. This is the pattern for features with many mutations.

### Bypassing the Error Interceptor
When a non-2xx response is expected and you don't want the global toast (e.g., super-admin querying a company with an expired subscription), pass `validateStatus: (s) => s < 500` to the apiClient call and handle the status manually. See `getCompanySubscription` in `src/services/subscription.ts`.

### Subscription Guard
`<SubscriptionGuard>` is rendered inside the `(dashboard)` layout. It fetches `/api/v1/subscription` and blocks the entire UI with a non-dismissible dialog when `status === "expired"`. `<TrialBanner>` renders a countdown for `trial`/`trialing` statuses. Neither runs for `super_admin` role (`enabled: !!user && user.role !== 'super_admin'`).

### Data Fetching
TanStack Query hooks either inline in page components or in dedicated hook files (`use-tickets.ts`, `use-work-orders.ts`). For features with many mutations (work orders), group all hooks in one file. Invalidate via `queryClient.invalidateQueries` in mutation `onSuccess`. Use `qc.setQueryData` for optimistic-style updates on detail queries.

### Feature Components
- Forms open in `<Sheet>` (slide-over). Delete confirmations open in `<Dialog>`.
- Both are controlled by local boolean state in the parent page.
- Table column definitions live in `columns.tsx` per feature; consumed by shared `<DataTable>`.
- **Exception — Work Orders**: custom layout (not `<DataTable>`). `/ordenes` groups by status (Por cobrar, Abiertas, En curso, Sin asignar, Cobradas hoy); the detail is a page (`/ordenes/[id]`, staff `/mis-ordenes/[id]`) rendered by the shared `<OrderView>`, which only draws the actions the API sends in `allowed_actions`. Create/edit is `<OrderForm>` (a one-column `<Sheet>`, fields by the company `order_mode`); charging is `<ChargeDialog>`.

### Date Formatting
Use `date-fns` with locale awareness: import `{ es, enUS } from "date-fns/locale"`, pick by `useLocale()`, and pass as `{ locale: dateLocale }` to `format()`.

### Charts
`@nivo/bar` and `@nivo/pie` are used for charts in `/estadisticas` and `/dashboard`. On the dashboard every bar or slice keeps its raw API key, navigates to the filtered list on click, and has a `ChartLegendLinks` legend of real links underneath (keyboard access). Colors come from `--chart-1..5` via `useChartColors()`.

### URL filters
List pages (`/empleados`, `/inventario`, `/ordenes`, `/tickets`, `/asistencia`) keep their filters in the URL with `useUrlFilters` (`src/hooks/use-url-filters.ts`), using the same param names as the API. Pages using it must wrap their content in `<Suspense>` (it reads `useSearchParams`). Dashboard and inicio cards are links to these filtered lists, shown only for modules in `active_modules` and roles allowed by the destination.

### Design system
Tokens come from `DESIGN.md` at the workspace root (Etiqueta de anaquel): use the semantic classes (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`) and the brand utilities (`bg-ceja`, `text-sello`, `shadow-etiqueta`, `font-display`). Text on `oferta`/`primary` is always `tinta`, never white.

### Server-Side Pagination
All list endpoints accept `page`, `page_size`, `search`. Backend returns `PaginatedResponse<T>` shape: `{ info: PaginationInfo, results: T[] }`. Use `use-pagination.ts` hook for pagination state.

### i18n
- `useTranslations("namespace")` in every component with text.
- Locale-aware navigation via `useAppRouter` hook (`src/hooks/use-router.ts`) — wraps `useRouter` to prepend `/{locale}` to all navigations.

### Multi-Company
Active company ID stored in `localStorage` (`selected_company_id`) and sent as `X-Company-Id` on every request. Changing the selected company triggers a full re-fetch.

### Styling
Use `cn()` from `src/lib/utils.ts` for all conditional classNames. Tailwind v4 — config is entirely in `src/app/globals.css` via `@theme inline` CSS variables. Do not create a `tailwind.config.ts`.

### Authentication
JWT stored in both `localStorage` (`auth_token`) and as a cookie (for middleware SSR access, 24h max-age). User role also stored as a cookie (`user_role`). Zustand auth store persists `{ token, user, selectedCompanyId }`. Creating an employee also creates a `User` account; the response includes a one-time `temp_password` field.

Admin role check pattern used in components: `["admin", "owner", "super_admin"].includes(user?.role)`.

### Role Hierarchy
`staff` < `manager` < `admin` < `owner` < `super_admin`. The `super_admin` role operates across all companies by passing an explicit `X-Company-Id` header; it bypasses the `<SubscriptionGuard>` and sees all companies via `/super-admin` routes.
