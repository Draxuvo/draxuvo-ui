"use client";
import { useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { Search, RefreshCw, CreditCard, X, CheckCircle2, Clock, CircleDot, XCircle, Ban, AlertTriangle } from "lucide-react";
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

type FilterStatus = "all" | "expired" | "expiring_soon" | "trial" | "active" | "past_due";

type RowData = {
  company: Company;
  subscription: Subscription | null;
  isLoadingSub: boolean;
};

type DisplayStatus =
  | "active"
  | "cancel_scheduled"
  | "past_due"
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
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "active" && sub.cancel_at_period_end) return "cancel_scheduled";
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
      if (filter === "past_due") return status === "past_due";
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
      toast.success(t("cancelScheduledSuccess"));
      queryClient.invalidateQueries({ queryKey: ["company-subscription", cancelCompany!.id] });
      setCancelCompany(null);
    },
    onError: () => toast.error(t("cancelError")),
  });

  const STATUS_CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
    active: { label: t("statusActive"), className: "bg-estado-completada text-estado-completada-foreground border-estado-completada-border" },
    cancel_scheduled: { label: t("statusCancelScheduled", { date: "" }).trim(), className: "bg-estado-pendiente text-estado-pendiente-foreground border-estado-pendiente-border" },
    past_due: { label: t("statusPastDue"), className: "bg-destructive/10 text-destructive border-destructive/30" },
    expiring_soon: { label: t("statusExpiringSoon"), className: "bg-estado-pendiente text-estado-pendiente-foreground border-estado-pendiente-border" },
    trial: { label: t("statusTrial"), className: "bg-estado-progreso text-estado-progreso-foreground border-estado-progreso-border" },
    expired: { label: t("statusExpired"), className: "bg-destructive/10 text-destructive border-destructive/30" },
    cancelled: { label: t("statusCancelled"), className: "bg-muted text-muted-foreground border-border" },
    none: { label: t("statusNone"), className: "bg-destructive/10 text-destructive border-destructive/30" },
  };

  const STATUS_ICON: Record<DisplayStatus, typeof Clock> = {
    active: CheckCircle2,
    cancel_scheduled: Clock,
    past_due: AlertTriangle,
    expiring_soon: Clock,
    trial: CircleDot,
    expired: XCircle,
    cancelled: Ban,
    none: XCircle,
  };

  const columns = useMemo<ColumnDef<RowData>[]>(
    () => [
      {
        id: "company",
        header: t("colCompany"),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.company.name}</span>
        ),
      },
      {
        id: "plan",
        header: t("colPlan"),
        cell: ({ row }) => {
          const { subscription, isLoadingSub } = row.original;
          if (isLoadingSub)
            return <span className="text-muted-foreground/50 text-xs animate-pulse">{t("loadingSub")}</span>;
          if (!subscription?.plan)
            return <span className="text-muted-foreground text-sm">{t("noPlan")}</span>;
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
            return <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />;
          const status = getDisplayStatus(subscription);
          const { label, className } = STATUS_CONFIG[status];
          const text =
            status === "cancel_scheduled" && subscription?.current_period_end
              ? t("statusCancelScheduled", {
                  date: format(new Date(subscription.current_period_end), "dd MMM yyyy"),
                })
              : label;
          const StatusIcon = STATUS_ICON[status];
          return (
            <Badge className={cn("text-xs gap-1", className)}>
              <StatusIcon size={11} aria-hidden="true" />
              {text}
            </Badge>
          );
        },
      },
      {
        id: "expiry",
        header: t("colExpiry"),
        cell: ({ row }) => {
          const { subscription, isLoadingSub } = row.original;
          if (isLoadingSub) return <div className="h-4 w-24 bg-muted animate-pulse rounded" />;
          if (!subscription) return <span className="text-muted-foreground text-sm">—</span>;
          const date = getExpiryDate(subscription);
          if (!date) return <span className="text-muted-foreground text-sm">—</span>;
          return (
            <span className="text-sm text-muted-foreground tabular-nums">
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
          if (isLoadingSub) return <div className="h-4 w-16 bg-muted animate-pulse rounded" />;
          if (!subscription) return <span className="text-muted-foreground text-sm">—</span>;
          const days = getDaysLeft(subscription);
          if (days === null) return <span className="text-muted-foreground text-sm">—</span>;
          if (days < 0)
            return (
              <span className="text-sm font-medium text-destructive">
                {t("expiredDays", { days: Math.abs(days) })}
              </span>
            );
          if (days === 0)
            return <span className="text-sm font-medium text-destructive">{t("today")}</span>;
          return (
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                days <= EXPIRING_SOON_DAYS ? "text-estado-pendiente-foreground" : "text-foreground",
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
          const canCancel = status === "active" || status === "expiring_soon";
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
                  className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
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
    { id: "past_due", label: t("filterPastDue") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-foreground">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("pageSubtitle", { count: companiesData?.info?.total ?? 0 })}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-card">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                "px-3 py-1 text-sm rounded font-medium transition-colors",
                filter === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
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
              {cancelCompany && t("cancelScheduledDesc", { company: cancelCompany.name })}
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
