/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/[locale]/(dashboard)/inicio/page.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/store/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { getSubscription } from "@/services/subscription";
import {
  Users,
  Package,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

export default function InicioPage() {
  const t = useTranslations("home");
  const user = useAuthStore((s) => s.user);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const canSeeSubscription = user?.role === "owner" || user?.role === "admin";
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () =>
      apiClient.get("/api/v1/employees?status=active").then((r) => r.data),
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.get("/api/v1/products").then((r) => r.data),
  });

  // Company ya no trae `plan`; la fuente es GET /subscription (solo owner/admin).
  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    enabled: canSeeSubscription,
    retry: false,
  });

  const employeeList = employees?.results ?? employees ?? [];
  const productList = products?.results ?? products ?? [];
  const activeEmployees = employeeList.length;
  const lowStock = productList.filter((p: any) => p.low_stock).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.refetchQueries({ queryKey: ["employees"] }),
        qc.refetchQueries({ queryKey: ["products"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const stats = [
    {
      label: t("activeEmployees"),
      value: activeEmployees,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: t("totalProducts"),
      value: products?.info?.total ?? productList.length ?? "—",
      icon: Package,
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      label: t("lowStock"),
      value: lowStock,
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: t("activePlan"),
      value: subscription?.plan ?? "—",
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium text-zinc-900">
            {t("welcome", { name: user?.first_name ?? "" })}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors disabled:pointer-events-none"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-zinc-200 p-5"
          >
            <div
              className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}
            >
              <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-medium text-zinc-900">{value}</p>
            <p className="text-xs text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
