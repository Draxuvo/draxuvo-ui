/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/[locale]/layout.tsx
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Providers } from "@/components/layout/providers";
import { Toaster } from "@/components/ui/sonner";
import { MODE_COOKIE, THEME_COOKIE, parseMode, parseTheme } from "@/lib/appearance";
import "../globals.css";

// DESIGN.md: Barlow (texto) y Barlow Condensed (números y titulares) como variables CSS.
// globals.css las expone como --font-sans y --font-display (utilidades font-sans y font-display).
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  // El servidor pinta el tema y el modo desde las cookies: sin destello al recargar (FR-004).
  const store = await cookies();
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);
  const mode = parseMode(store.get(MODE_COOKIE)?.value);

  return (
    <html
      lang={locale}
      data-theme={theme}
      data-mode={mode}
      className={`${barlow.variable} ${barlowCondensed.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {children}
            <Toaster position="top-center" />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
