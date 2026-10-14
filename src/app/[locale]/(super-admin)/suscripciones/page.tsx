"use client";
import { useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { Search, RefreshCw, CreditCard, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompanyCheckoutDialog } from "@/components/subscription/company-checkout-dialog";
import { companiesService } from "@/services/companies";
import { getCompanySubscription, cancelCompanySubscription } from "@/services/subscription";
import { cn } from "@/lib/utils";
import type { Company, Subscription } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";

const EXPIRING_SOON_DAYS = 7;
const PAGE_SIZE = 50;

type FilterStatus = "all" | "expired" | "expiring_soon" | "trial" | "active";

type RowData = {
  company: Company;
  subscription: Subscription | null;
  isLoadingSub: boolean;
};

type DisplayStatus =
  | "active"
  | "expiring_soon"
  | "trial"
  | "expired"
  | "cancelled"
  | "none";

function getDaysLeft(sub: Subscription): number | null {
  const raw = sub.current_period_end ?? sub.trial_ends_at;
  return raw ? differenceInDays(new Date(raw), new Date()) : null;
}

function getExpiryDate(sub: Subscription): Date | null {
  const raw = sub.current_period_end ?? sub.trial_ends_at;
  return raw ? new Date(raw) : null;
}

function getDisplayStatus(sub: Subscription | null): DisplayStatus {
  if (!sub) return "none";
  const isTrial = sub.status === "trialing";
  const daysLeft = getDaysLeft(sub);
  if (sub.status === "expired" || (isTrial && daysLeft !== null && daysLeft <= 0))
    return "expired";
  if (sub.status === "cancelled") return "cancelled";
  if (isTrial) return "trial";
  if (sub.status === "active" && daysLeft !== null && daysLeft <= EXPIRING_SOON_DAYS)
    return "expiring_soon";
  if (sub.status === "active") return "active";
  return "none";
}

export default function SuscripcionesPage() {
  const t = useTranslations("adminSubscriptions");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [checkoutCompany, setCheckoutCompany] = useState<Company | null>(null);
  const [cancelCompany, setCancelCompany] = useState<Company | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: companiesData, isLoading: companiesLoading, isFetching, refetch } = useQuery({
    queryKey: ["companies-for-subscriptions", debouncedSearch],
    queryFn: () => companiesService.list(1, debouncedSearch, PAGE_SIZE),
  });

  const companies: Company[] = companiesData?.results ?? [];

  const subscriptionQueries = useQueries({
    queries: companies.map((company) => ({
      queryKey: ["company-subscription", company.id],
      queryFn: () => getCompanySubscription(company.id),
      retry: false,
      staleTime: 2 * 60 * 1000,
    })),
  });

  const rows: RowData[] = useMemo(
    () =>
      companies.map((company, i) => ({
        company,
        subscription: subscriptionQueries[i]?.data ?? null,
        isLoadingSub: subscriptionQueries[i]?.isLoading ?? true,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, subscriptionQueries.map((q) => q.data).join(",")],
  );

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => {
      const status = getDisplayStatus(row.subscription);
      if (filter === "expired") return status === "expired" || status === "none";
      if (filter === "expiring_soon") return status === "expiring_soon";
      if (filter === "trial") return status === "trial";
      if (filter === "active") return status === "active";
      return true;
    });
  }, [rows, filter]);

  function handleSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(value), 400);
  }

  const { mutate: cancelMutation, isPending: cancelling } = useMutation({
    mutationFn: () => cancelCompanySubscription(cancelCompany!.id),
    onSuccess: () => {
      toast.success(t("cancelSuccess"));
      queryClient.invalidateQueries({ queryKey: ["company-subscription", cancelCompany!.id] });
      setCancelCompany(null);
    },
    onError: () => toast.error(t("cancelError")),
  });

  const STATUS_CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
    active: { label: t("statusActive"), className: "bg-green-100 text-green-800 border-green-200" },
    expiring_soon: { label: t("statusExpiringSoon"), className: "bg-amber-100 text-amber-800 border-amber-200" },
    trial: { label: t("statusTrial"), className: "bg-blue-100 text-blue-800 border-blue-200" },
    expired: { label: t("statusExpired"), className: "bg-red-100 text-red-800 border-red-200" },
    cancelled: { label: t("statusCancelled"), className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
    none: { label: t("statusNone"), className: "bg-red-100 text-red-800 border-red-200" },
  };

  const columns = useMemo<ColumnDef<RowData>[]>(
    () => [
      {
        id: "company",
        header: t("colCompany"),
        cell: ({ row }) => (
          <span className="font-medium text-zinc-900">{row.original.company.name}</span>
        ),
      },
      {
        id: "plan",
        header: t("colPlan"),
        cell: ({ row }) => {
          const { subscription, isLoadingSub } = row.original;
          if (isLoadingSub)
            return <span className="text-zinc-300 text-xs animate-pulse">{t("loadingSub")}</span>;
          if (!subscription?.plan)
            return <span className="text-zinc-400 text-sm">{t("noPlan")}</span>;
          return (
            <Badge variant="outline" className="capitalize text-xs">
              {subscription.plan}
            </Badge>
          );
        },
      },
      {
        id: "status",
        header: t("colStatus"),
        cell: ({ row }) => {
          const { subscription, isLoadingSub } = row.original;
          if (isLoadingSub)
            return <div className="h-5 w-20 bg-zinc-100 animate-pulse rounded-full" />;
          const status = getDisplayStatus(subscription);
          const { label, className } = STATUS_CONFIG[status];
          return <Badge className={cn("text-xs", className)}>{label}</Badge>;
        },
      },
      {
        id: "expiry",
        header: t("colExpiry"),
        cell: ({ row }) => {
          const { subscription, isLoadingSub } = row.original;
          if (isLoadingSub) return <div className="h-4 w-24 bg-zinc-100 animate-pulse rounded" />;
          if (!subscription) return <span className="text-zinc-400 text-sm">—</span>;
          const date = getExpiryDate(subscription);
          if (!date) return <span className="text-zinc-400 text-sm">—</span>;
          return (
            <span className="text-sm text-zinc-600 tabular-nums">
              {format(date, "dd MMM yyyy")}
            </span>
          );
        },
      },
      {
        id: "days_left",
        header: t("colDaysLeft"),
        cell: ({ row }) => {
          const { subscription, isLoadingSub } = row.original;
          if (isLoadingSub) return <div className="h-4 w-16 bg-zinc-100 animate-pulse rounded" />;
          if (!subscription) return <span className="text-zinc-400 text-sm">—</span>;
          const days = getDaysLeft(subscription);
          if (days === null) return <span className="text-zinc-400 text-sm">—</span>;
          if (days < 0)
            return (
              <span className="text-sm font-medium text-red-600">
                {t("expiredDays", { days: Math.abs(days) })}
              </span>
            );
          if (days === 0)
            return <span className="text-sm font-medium text-red-600">{t("today")}</span>;
          return (
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                days <= EXPIRING_SOON_DAYS ? "text-amber-600" : "text-zinc-700",
              )}
            >
              {t("daysLeft", { days })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: t("colActions"),
        cell: ({ row }) => {
          const { company, subscription, isLoadingSub } = row.original;
          const status = getDisplayStatus(subscription);
          const canCancel = status === "active" || status === "expiring_soon" || status === "trial";
          return (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs"
                disabled={isLoadingSub}
                onClick={() => setCheckoutCompany(company)}
              >
                <CreditCard size={12} />
                {t("checkoutBtn")}
              </Button>
              {canCancel && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={isLoadingSub}
                  onClick={() => setCancelCompany(company)}
                >
                  <X size={12} />
                  {t("cancelBtn")}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const FILTERS: { id: FilterStatus; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "expired", label: t("filterExpired") },
    { id: "expiring_soon", label: t("filterExpiringSoon") },
    { id: "trial", label: t("filterTrial") },
    { id: "active", label: t("filterActive") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-zinc-900">{t("pageTitle")}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {t("pageSubtitle", { count: companiesData?.info?.total ?? 0 })}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            className="pl-8"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 border border-zinc-200 rounded-md p-0.5 bg-white">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                "px-3 py-1 text-sm rounded font-medium transition-colors",
                filter === id
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        pageSize={PAGE_SIZE}
        isLoading={companiesLoading}
        loadingMessage={tc("loading")}
        emptyMessage={t("empty")}
      />

      <CompanyCheckoutDialog
        company={checkoutCompany}
        onOpenChange={(open) => !open && setCheckoutCompany(null)}
      />

      <Dialog open={!!cancelCompany} onOpenChange={(o) => !o && setCancelCompany(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>
              {cancelCompany && t("cancelDesc", { company: cancelCompany.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelCompany(null)} disabled={cancelling}>
              {t("cancelClose")}
            </Button>
            <Button variant="destructive" onClick={() => cancelMutation()} disabled={cancelling}>
              {t("cancelConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
