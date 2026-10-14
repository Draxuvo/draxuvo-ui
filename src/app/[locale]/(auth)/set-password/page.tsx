// src/app/[locale]/(auth)/set-password/page.tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import logo from "../../../../../public/logo.svg";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { setPassword } from "@/services/auth";

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

export default function SetPasswordPage() {
  const t = useTranslations("setPassword");
  const tc = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const schema = z
    .object({
      password: z.string().min(8, t("passwordMin")),
      confirm: z.string().min(1, t("confirmRequired")),
    })
    .refine((d) => d.password === d.confirm, {
      message: t("passwordMismatch"),
      path: ["confirm"],
    });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit({ password, confirm }: FormValues) {
    try {
      await setPassword(token!, password, confirm);
      setDone(true);
      toast.success(t("successToast"));
      setTimeout(() => router.push(`/${locale}/login`), 2500);
    } catch {
      // error handled by the global interceptor
    }
  }

  /* ── No token in URL ── */
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 px-6">
        <div className="text-center max-w-sm">
          <ShieldAlert size={40} className="text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {t("invalidLinkTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">{t("invalidLinkDesc")}</p>
          <Button variant="outline" onClick={() => router.push(`/${locale}/login`)}>
            {t("backToLogin")}
          </Button>
        </div>
      </div>
    );
  }

  /* ── Password set successfully ── */
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50 px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-estado-completada flex items-center justify-center mx-auto mb-4">
            <KeyRound size={24} className="text-estado-completada-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {t("successTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("successDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <BrandMark />
          <div>
            <p className="font-semibold text-foreground leading-tight">{tc("brandName")}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">{tc("brandTagline")}</p>
          </div>
        </div>

        <div className="mb-7 text-center">
          <h2 className="text-2xl font-semibold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* New password */}
              <div className="space-y-1.5">
                <Label className="text-sm">{t("password")}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label className="text-sm">{t("confirm")}</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    className="pr-10"
                    {...register("confirm")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.confirm && (
                  <p className="text-xs text-destructive">{errors.confirm.message}</p>
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
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => router.push(`/${locale}/login`)}
          >
            {t("backToLogin")}
          </button>
        </p>
      </div>
    </div>
  );
}
