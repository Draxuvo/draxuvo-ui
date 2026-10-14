// src/components/layout/locale-switcher.tsx
"use client";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(next: string) {
    const newPath = pathname.replace(`/${locale}`, `/${next}`);
    router.push(newPath);
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className={`text-xs px-2 h-7 ${locale === "es" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
        onClick={() => switchLocale("es")}
      >
        ES
      </Button>
      <span aria-hidden="true" className="text-border text-xs">|</span>
      <Button
        variant="ghost"
        size="sm"
        className={`text-xs px-2 h-7 ${locale === "en" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
        onClick={() => switchLocale("en")}
      >
        EN
      </Button>
    </div>
  );
}
