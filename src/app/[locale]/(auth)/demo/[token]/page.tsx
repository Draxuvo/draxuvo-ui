// src/app/[locale]/(auth)/demo/[token]/page.tsx
// Invitación a la demo (spec 039): la genera el equipo comercial; aquí se resuelve a un plan y se entra.
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { DemoEntry } from "@/components/demo/demo-entry";
import { DemoShell } from "@/components/demo/demo-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { demoService } from "@/services/demo";

export default function DemoInvitePage() {
  const t = useTranslations("demo.invite");
  const locale = useLocale();
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["demo-invite", token],
    queryFn: () => demoService.resolveInvite(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <DemoShell>
        <p className="mb-4 text-sm text-muted-foreground">{t("checking")}</p>
        <Skeleton className="h-64 w-full rounded-etiqueta" />
      </DemoShell>
    );
  }

  if (error || !data) {
    const code = isAxiosError(error) ? (error.response?.data?.error?.details?.code as string | undefined) : undefined;
    const message = code === "invite_expired" ? t("expired") : code === "invite_revoked" ? t("revoked") : t("notFound");
    return (
      <DemoShell>
        <h1 className="font-display text-[2rem] font-extrabold uppercase leading-none">{t("invalidTitle")}</h1>
        <p role="alert" className="mt-3 text-base text-muted-foreground">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/${locale}/demo`} className={cn(buttonVariants(), "h-11 rounded-etiqueta")}>
            {t("tryAnother")}
          </Link>
          <Link href={`/${locale}/registro`} className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-etiqueta")}>
            {t("createAccount")}
          </Link>
        </div>
      </DemoShell>
    );
  }

  return (
    <DemoShell>
      <DemoEntry invite={{ token, plan: data.plan, scenario: data.scenario }} />
    </DemoShell>
  );
}
