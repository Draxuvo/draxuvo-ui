// src/app/[locale]/(auth)/recuperar-contrasena/page.tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import logo from "../../../../../public/logo.svg";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { resetPassword } from "@/services/auth";

function BrandMark() {
  return (
    <Image
      src={logo}
      alt=""
      width={40}
      height={40}
      unoptimized
      className="w-10 h-10 shrink-0"
    />
  );
}

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const tc = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const [done, setDone] = useState(false);

  const schema = z.object({
    email: z.string().email(t("emailInvalid")),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit({ email }: FormValues) {
    try {
      await resetPassword(email);
    } catch {
      // swallow errors — always show success to avoid user enumeration
    } finally {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Mail size={24} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">
            {t("successTitle")}
          </h2>
          <p className="text-sm text-slate-500 mb-6">{t("successDesc")}</p>
          <Button variant="outline" onClick={() => router.push(`/${locale}/login`)}>
            {t("backToLogin")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <BrandMark />
          <div>
            <p className="font-semibold text-slate-900 leading-tight">{tc("brandName")}</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">{tc("brandTagline")}</p>
          </div>
        </div>

        <div className="mb-7 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">{t("title")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
        </div>

        <Card className="shadow-sm border-slate-200 bg-white">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("email")}</Label>
                <Input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t("submitting") : t("submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center mt-5">
          <button
            type="button"
            className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
            onClick={() => router.push(`/${locale}/login`)}
          >
            {t("backToLogin")}
          </button>
        </p>
      </div>
    </div>
  );
}
