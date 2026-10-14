// src/components/layout/employee-header.tsx
"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { LogOut, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanySwitcher } from "./company-switcher";

export function EmployeeHeader() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, selectedCompanyId } = useAuthStore();
  const companies = user?.companies ?? [];
  const companyName = (companies.find((c) => c.id === selectedCompanyId) ?? companies[0])?.name;

  function switchLocale(next: string) {
    router.push(pathname.replace(`/${locale}`, `/${next}`));
  }

  return (
    <header className="h-14 shrink-0 border-b border-zinc-200 bg-white flex items-center justify-between px-5">
      {/* Left: user info */}
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-medium text-zinc-800 truncate">
          {user?.first_name} {user?.last_name}
        </p>
        {companies.length > 1 ? (
          <CompanySwitcher className="ml-2" />
        ) : (
          companyName && (
            <>
              <span className="text-zinc-300 text-xs">·</span>
              <p className="text-xs text-zinc-400 truncate">{companyName}</p>
            </>
          )
        )}
      </div>

      {/* Right: locale + logout */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center gap-0.5 mr-1">
          <Globe size={13} className="text-zinc-400 mr-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => switchLocale("es")}
            className={`text-xs px-2 h-7 ${locale === "es" ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
          >
            ES
          </Button>
          <span className="text-zinc-200 text-xs">|</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => switchLocale("en")}
            className={`text-xs px-2 h-7 ${locale === "en" ? "font-semibold text-zinc-900" : "text-zinc-400"}`}
          >
            EN
          </Button>
        </div>

        <div className="w-px h-4 bg-zinc-200 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-xs text-zinc-500 hover:text-zinc-800 gap-1.5 px-2.5"
        >
          <LogOut size={13} />
          {t("logout")}
        </Button>
      </div>
    </header>
  );
}
