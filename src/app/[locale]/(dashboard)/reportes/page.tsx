"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Building2, FileBarChart2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { companiesService } from "@/services/companies";
import { ReportContent } from "@/components/reports/report-content";
import { ModuleLocked, useModuleLocked } from "@/components/subscription/module-locked";

export default function ReportesPage() {
  const t = useTranslations("reports");
  const tc = useTranslations("companies");
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";

  const [companyId, setCompanyId] = useState<number | null>(null);

  const companiesQuery = useQuery({
    queryKey: ["companies-all"],
    queryFn: () => companiesService.list(1, "", 200),
    enabled: isSuperAdmin,
  });

  const companies = companiesQuery.data?.results ?? [];

  const locked = useModuleLocked("reports");
  if (locked) return <ModuleLocked module="reports" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-medium text-zinc-900">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{t("subtitle")}</p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-zinc-400 shrink-0" />
            {companiesQuery.isLoading ? (
              <div className="h-9 w-48 bg-zinc-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={companyId ?? ""}
                onChange={(e) =>
                  setCompanyId(e.target.value ? Number(e.target.value) : null)
                }
                className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 min-w-48"
              >
                <option value="">{tc("selectCompany")}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {isSuperAdmin && !companyId ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FileBarChart2 size={40} className="text-zinc-300 mb-3" />
          <p className="text-sm text-zinc-400">{tc("selectCompanyPrompt")}</p>
        </div>
      ) : (
        <ReportContent companyId={companyId ?? undefined} />
      )}
    </div>
  );
}
