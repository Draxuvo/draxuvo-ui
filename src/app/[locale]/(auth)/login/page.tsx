/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/[locale]/(auth)/login/page.tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import logo from "../../../../../public/logo.svg";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const FEATURE_ICONS = [
  <svg
    key="feature-icon-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="w-5 h-5"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
    />
  </svg>,
  <svg
    key="feature-icon-1"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="w-5 h-5"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75"
    />
  </svg>,
  <svg
    key="feature-icon-2"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="w-5 h-5"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
    />
  </svg>,
];

function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const px = size === "sm" ? 28 : 40;
  const dim = size === "sm" ? "w-7 h-7" : "w-10 h-10";
  return (
    <Image
      src={logo}
      alt=""
      width={px}
      height={px}
      unoptimized
      className={`${dim} shrink-0`}
    />
  );
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const features = [
    {
      labelKey: "feature1Label",
      descKey: "feature1Desc",
      icon: FEATURE_ICONS[0],
    },
    {
      labelKey: "feature2Label",
      descKey: "feature2Desc",
      icon: FEATURE_ICONS[1],
    },
    {
      labelKey: "feature3Label",
      descKey: "feature3Desc",
      icon: FEATURE_ICONS[2],
    },
  ];

  const loginSchema = z.object({
    email: z.string().email(t("emailInvalid")),
    password: z.string().min(1, t("passwordRequired")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: any) {
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

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden bg-slate-950 text-white select-none">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        {/* Ambient glows */}
        <div className="absolute -bottom-24 -left-24 w-[420px] h-[420px] bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-orange-700/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand top-left */}
        <div className="relative z-10 flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-semibold text-base leading-tight">{tc("brandName")}</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">
              {tc("brandTagline")}
            </p>
          </div>
        </div>

        {/* Hero copy + feature list */}
        <div className="relative z-10 space-y-10">
          <div>
            <h1 className="text-[2.6rem] font-bold leading-tight tracking-tight">
              {t("heroTitle")}
              <br />
              <span className="text-amber-400">{t("heroTitleHighlight")}</span>
            </h1>
            <p className="mt-4 text-slate-400 text-sm leading-relaxed max-w-sm">
              {t("heroSubtitle")}
            </p>
          </div>

          <ul className="space-y-3">
            {features.map((f) => (
              <li
                key={f.labelKey}
                className="flex items-center gap-3.5 bg-white/[0.04] hover:bg-white/[0.07] transition-colors rounded-xl px-4 py-3.5 border border-white/[0.08]"
              >
                <span className="text-amber-400 shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-medium leading-none mb-0.5">
                    {t(f.labelKey as any)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t(f.descKey as any)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-slate-700">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <BrandMark size="sm" />
            <span className="font-semibold text-slate-900">{tc("brandName")}</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-slate-900">
              {t("title")}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
          </div>

          <Card className="shadow-sm border-slate-200 bg-white">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("email")}</Label>
                  <Input
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">
                      {errors.email.message as string}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("password")}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("passwordPlaceholder")}
                      className="pr-10"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                    >
                      {showPassword ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          className="w-4 h-4"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                          />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          className="w-4 h-4"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500">
                      {errors.password.message as string}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("submitting") : t("submit")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center mt-5">
            <button
              type="button"
              className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
              onClick={() => router.push(`/${locale}/recuperar-contrasena`)}
            >
              {t("forgotPassword")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
