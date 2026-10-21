// src/components/layout/company-switcher.tsx
// Selector de empresa (US6, contracts/ui-routes.md): solo con más de una empresa. Cada opción
// muestra el nombre y el rol en esa empresa; al cambiar se limpia la caché y se vuelve al inicio.
"use client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth";
import { useAppRouter } from "@/hooks/use-router";
import { cn } from "@/lib/utils";

/** Cambia de empresa y lleva a la portada del rol nuevo. */
export function useSwitchCompany() {
  const selectCompany = useAuthStore((s) => s.selectCompany);
  const router = useAppRouter();
  return (id: number) => {
    const role = selectCompany(id);
    router.push(role === "staff" ? "/mis-ordenes" : "/inicio");
  };
}

export function CompanySwitcher({ className }: { className?: string }) {
  const t = useTranslations("companySwitcher");
  const tRoles = useTranslations("adminUsers.roles");
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const switchCompany = useSwitchCompany();

  // El super admin dentro de su empresa (spec 029) solo cambia entre las que administra.
  const companies = (user?.companies ?? []).filter(
    (c) => user?.role !== "super_admin" || c.role === "admin" || c.role === "owner",
  );
  if (role === "super_admin" || companies.length < 2) return null;

  const active = companies.find((c) => c.id === selectedCompanyId) ?? companies[0];

  function handleChange(value: string) {
    const next = companies.find((c) => String(c.id) === value);
    if (!next || next.id === active.id) return;
    switchCompany(next.id);
    toast.success(t("switched", { company: next.name }));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("trigger", { company: active.name, role: tRoles(active.role) })}
          className={cn(
            "foco-etiqueta flex min-h-11 min-w-0 items-center gap-2 rounded-etiqueta border border-border bg-card px-2.5 text-left transition-colors duration-[120ms] hover:border-foreground/40",
            className,
          )}
        >
          <Building2 size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 leading-tight">
            <span className="block max-w-36 truncate text-sm font-semibold text-foreground sm:max-w-48">
              {active.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {tRoles(active.role)}
            </span>
          </span>
          <ChevronsUpDown size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t("heading")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={String(active.id)} onValueChange={handleChange}>
          {companies.map((company) => (
            <DropdownMenuRadioItem
              key={company.id}
              value={String(company.id)}
              className="min-h-11 rounded-etiqueta"
            >
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-semibold text-foreground">{company.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {tRoles(company.role)}
                  {company.parent_company_id ? ` · ${t("branch")}` : ""}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
