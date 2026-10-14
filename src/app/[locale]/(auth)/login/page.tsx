// src/app/[locale]/(auth)/login/page.tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "../../../../../public/logo.svg";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BarChart3, ClipboardList, Eye, EyeOff, Package } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FIELD =
  "h-11 rounded-[6px] border-border bg-card px-3 text-base focus-visible:border-foreground focus-visible:ring-foreground/15";

const TEXT_LINK =
  "rounded-[2px] underline decoration-anaquel-borde decoration-2 underline-offset-4 transition-colors duration-[120ms] hover:decoration-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const FEATURES = [
  { labelKey: "feature1Label", descKey: "feature1Desc", icon: Package },
  { labelKey: "feature2Label", descKey: "feature2Desc", icon: ClipboardList },
  { labelKey: "feature3Label", descKey: "feature3Desc", icon: BarChart3 },
] as const;

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(t("emailInvalid")),
    password: z.string().min(1, t("passwordRequired")),
  });
  type LoginValues = z.infer<typeof loginSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginValues) {
    setLoading(true);
    try {
      await login(data.email, data.password);
      const { user } = useAuthStore.getState();
      if (user?.role === "super_admin") {
        router.push(`/${locale}/empresas`);
      } else if (user?.role === "staff") {
        router.push(`/${locale}/mis-ordenes`);
      } else {
        router.push(`/${locale}/inicio`);
      }
    } catch {
      // error manejado por el interceptor
    } finally {
      setLoading(false);
    }
  }

  const emailError = errors.email?.message;
  const passwordError = errors.password?.message;

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Ceja: la banda de precio del anaquel lleva la marca */}
      <header className="border-b border-foreground/15 bg-ceja">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2.5 px-4 sm:px-6">
          <Image src={logo} alt="" width={32} height={32} unoptimized className="size-8 shrink-0" />
          <span className="font-display text-xl font-extrabold uppercase tracking-[0.01em]">
            {tc("brandName")}
          </span>
          <span className="ml-auto hidden text-sm font-medium text-gris-texto sm:block">
            {tc("brandTagline")}
          </span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-4 py-8 sm:px-6 content-start lg:content-center lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16 lg:py-16">
        {/* Contexto (solo escritorio): el formulario es lo principal */}
        <section className="hidden lg:block">
          <p className="font-display text-[3.5rem] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-balance">
            {t("heroTitle")}{" "}
            <span className="box-decoration-clone bg-ceja px-1.5">{t("heroTitleHighlight")}</span>
          </p>
          <p className="mt-5 max-w-[42ch] text-base leading-[1.55] text-muted-foreground">
            {t("heroSubtitle")}
          </p>
          <ul className="mt-10 grid gap-5">
            {FEATURES.map(({ labelKey, descKey, icon: Icon }) => (
              <li key={labelKey} className="flex items-start gap-3">
                <Icon size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{t(labelKey)}</p>
                  <p className="text-sm text-muted-foreground">{t(descKey)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="w-full">
          <div className="rounded-[6px] border border-border bg-card p-6 shadow-etiqueta sm:p-8">
            <h1 className="font-display text-[2rem] font-extrabold uppercase leading-none tracking-[-0.01em]">
              {t("subtitle")}
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold">
                  {t("email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                  className={FIELD}
                  {...register("email")}
                />
                {emailError && (
                  <p id="email-error" className="text-sm text-destructive">
                    {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold">
                  {t("password")}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t("passwordPlaceholder")}
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : undefined}
                    className={cn(FIELD, "pr-12")}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[6px] text-muted-foreground transition-colors duration-[120ms] hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                  >
                    {showPassword ? (
                      <EyeOff size={20} strokeWidth={1.75} aria-hidden />
                    ) : (
                      <Eye size={20} strokeWidth={1.75} aria-hidden />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p id="password-error" className="text-sm text-destructive">
                    {passwordError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-[6px] text-base font-semibold focus-visible:ring-foreground/40"
              >
                {loading ? t("submitting") : t("submit")}
              </Button>

              <p className="text-center text-sm">
                <Link href={`/${locale}/recuperar-contrasena`} className={cn(TEXT_LINK, "text-muted-foreground hover:text-foreground")}>
                  {t("forgotPassword")}
                </Link>
              </p>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href={`/${locale}/registro`} className={cn(TEXT_LINK, "font-semibold text-foreground")}>
              {t("register")}
            </Link>
          </p>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-6 text-xs text-muted-foreground sm:px-6">
        {t("copyright", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
