// src/components/login-attempts/access-filters.tsx — filtros de «Accesos» (spec 073, FR-011). Viven en la URL: el
// componente solo avisa qué cambió.
"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CHANNELS, RESULTS } from "@/lib/login-attempts";
import { companiesService } from "@/services/companies";
import type { LoginAttemptFilters } from "@/types";

export type FilterChange = Partial<Record<"result" | "q" | "company" | "ip" | "channel" | "since" | "from" | "to", string | null>>;

export function AccessFilters({ filters, onChange }: { filters: LoginAttemptFilters; onChange: (change: FilterChange) => void }) {
  const t = useTranslations("accessLog.filters");
  const tResults = useTranslations("accessLog.results");
  const tChannels = useTranslations("accessLog.channels");
  const companies = useQuery({ queryKey: ["companies", "all-for-filter"], queryFn: () => companiesService.list(1, "", 100) });


  const result = filters.result?.length === 1 ? filters.result[0] : (filters.result?.join(",") ?? "");
  const hasFilters = Object.keys(filters).some((key) => !["page", "page_size"].includes(key));

  return (
    <form
      className="grid gap-3 rounded-etiqueta border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      // Texto e IP se aplican al enviar, no con cada tecla.
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onChange({ q: String(form.get("q") ?? "").trim() || null, ip: String(form.get("ip") ?? "").trim() || null });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="access-q">{t("search")}</Label>
        <Input id="access-q" name="q" key={filters.q ?? ""} defaultValue={filters.q ?? ""} placeholder={t("searchPlaceholder")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="access-ip">{t("ip")}</Label>
        <Input id="access-ip" name="ip" key={filters.ip ?? ""} defaultValue={filters.ip ?? ""} placeholder="189.203.10.4" inputMode="decimal" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="access-result">{t("result")}</Label>
        <Select id="access-result" value={result} onChange={(e) => onChange({ result: e.target.value || null })}>
          <option value="">{t("all")}</option>
          <option value="failures">{t("failures")}</option>
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {tResults(r)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="access-channel">{t("channel")}</Label>
        <Select id="access-channel" value={filters.channel ?? ""} onChange={(e) => onChange({ channel: e.target.value || null })}>
          <option value="">{t("all")}</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {tChannels(c)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="access-company">{t("company")}</Label>
        <Select
          id="access-company"
          value={filters.company_id ? String(filters.company_id) : ""}
          onChange={(e) => onChange({ company: e.target.value || null })}
        >
          <option value="">{t("allCompanies")}</option>
          {companies.data?.results.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="access-from">{t("from")}</Label>
        <Input id="access-from" type="date" value={filters.from ?? ""} onChange={(e) => onChange({ from: e.target.value || null, since: null })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="access-to">{t("to")}</Label>
        <Input id="access-to" type="date" value={filters.to ?? ""} onChange={(e) => onChange({ to: e.target.value || null, since: null })} />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" className="min-h-10 flex-1">
          {t("apply")}
        </Button>
        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            onClick={() => onChange({ result: null, q: null, company: null, ip: null, channel: null, since: null, from: null, to: null })}
          >
            {t("clear")}
          </Button>
        )}
      </div>
      {filters.since && <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{t("sinceActive", { minutes: filters.since })}</p>}
    </form>
  );
}
