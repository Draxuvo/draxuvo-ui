"use client";
// Pie de Activas: lo cobrado hoy vive en la pestaña Cobradas (spec 051), sin duplicar la lista.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function PaidTodayLink({ count }: { count: number }) {
  const t = useTranslations("ordersView");
  const pathname = usePathname();
  return (
    <p className="border-t border-border pt-4 text-sm">
      <Link href={`${pathname}?vista=cobradas`} className="inline-flex min-h-10 items-center font-medium text-foreground underline underline-offset-4 foco-etiqueta">
        {t("paidTodayLink", { count })}
      </Link>
    </p>
  );
}
