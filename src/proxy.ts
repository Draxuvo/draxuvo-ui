// src/middleware.ts
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_ROUTES = ["/login", "/set-password", "/recuperar-contrasena", "/registro"];
const ADMIN_ROUTES = [
  "/dashboard",
  "/inicio",
  "/empleados",
  "/inventario",
  "/ordenes",
  "/tickets",
  "/asistencia",
  "/equipo",
  "/mis-empresas",
  "/restaurante",
  "/terminales",
];

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(es|en)/);
  const locale = localeMatch?.[1] ?? "es";
  const bare = pathname.replace(/^\/(es|en)/, "") || "/";

  const token = request.cookies.get("auth_token")?.value;
  // Rol en la empresa activa: lo escribe el store de auth al entrar y al cambiar de empresa.
  const role = request.cookies.get("user_role")?.value;
  const isPublic = PUBLIC_ROUTES.includes(bare);

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // set-password always accessible, even with an active session
  if (token && isPublic && bare !== "/set-password") {
    const dest =
      role === "super_admin"
        ? `/${locale}/empresas`
        : role === "staff"
          ? `/${locale}/mis-ordenes`
          : `/${locale}/inicio`;
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Staff solo puede ver sus propias órdenes
  if (token && role === "staff") {
    const isAdminRoute = ADMIN_ROUTES.some((r) => bare.startsWith(r));
    if (isAdminRoute) {
      return NextResponse.redirect(
        new URL(`/${locale}/mis-ordenes`, request.url),
      );
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
