// src/components/charge-queue/charge-queue-chip.tsx
// Contador «Por cobrar» del encabezado (spec 058, FR-020): con «Cobro solo por jefes», el dueño y el administrador ven
// cuántas ventas, órdenes y cuentas esperan su cobro y van a cada lista en un paso. Se sondea cada 30 s y no se pinta
// con la cola vacía.
"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { HandCoins } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBossOnlyCharge, useIsChargeBoss } from "@/hooks/use-boss-only-charge";
import { chargeQueueService } from "@/services/charge-queue";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

export function ChargeQueueChip({ className }: { className?: string }) {
  const boss = useIsChargeBoss();
  const bossOnly = useBossOnlyCharge();
  if (!boss || !bossOnly) return null;
  return <Chip className={className} />;
}

function Chip({ className }: { className?: string }) {
  const t = useTranslations("chargeQueue");
  const locale = useLocale();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const { data } = useQuery({
    queryKey: ["charge-queue", companyId],
    queryFn: chargeQueueService.get,
    refetchInterval: 30_000,
    retry: false,
  });

  if (!data?.enabled || data.total === 0) return null;

  const links = [
    { key: "sales", count: data.sales, href: "/venta?vista=por-cobrar" },
    { key: "workOrders", count: data.work_orders, href: "/ordenes" },
    { key: "checks", count: data.checks, href: "/restaurante" },
  ].filter((link) => link.count > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("label", { count: data.total })}
          className={cn(
            "foco-etiqueta flex min-h-11 shrink-0 items-center gap-1.5 rounded-etiqueta bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors duration-[120ms] hover:bg-primary/90",
            className,
          )}
        >
          <HandCoins size={18} strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">{t("title")}</span>
          <span className="tabular-nums">{data.total > 99 ? "99+" : data.total}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        {links.map((link) => (
          <DropdownMenuItem key={link.key} asChild>
            <Link href={`/${locale}${link.href}`} className="flex min-h-11 items-center justify-between gap-3">
              <span>{t(link.key)}</span>
              <span className="tabular-nums font-semibold">{link.count}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
