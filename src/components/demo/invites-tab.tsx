// src/components/demo/invites-tab.tsx
// Invitaciones a la demo (spec 039): lista, crear y revocar. El enlace no se puede recuperar después de crearlo.
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEMO_PLANS } from "@/lib/demo";
import { demoService } from "@/services/demo";
import type { DemoInvite, DemoInviteStatus, DemoPlan } from "@/types";
import { InviteDialog } from "./invite-dialog";
import { Select } from "@/components/ui/select";

const STATUSES: DemoInviteStatus[] = ["active", "expired", "revoked"];
const TONE: Record<DemoInviteStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  expired: "secondary",
  revoked: "destructive",
};
const PAGE_SIZE = 20;

export function InvitesTab() {
  const t = useTranslations("demo.admin");
  const ti = useTranslations("demo.admin.invites");
  const tp = useTranslations("plans");
  const ts = useTranslations("demo.entry.scenarios");
  const locale = useLocale();
  const qc = useQueryClient();

  const [status, setStatus] = useState<DemoInviteStatus | "">("");
  const [plan, setPlan] = useState<DemoPlan | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<DemoInvite | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["demo-invites", status, plan, search, page],
    queryFn: () =>
      demoService.listInvites({
        page,
        page_size: PAGE_SIZE,
        status: status || undefined,
        plan: plan || undefined,
        search: search.trim() || undefined,
      }),
  });

  const revoke = useMutation({
    mutationFn: (invite: DemoInvite) => demoService.revokeInvite(invite.id),
    onSuccess: () => {
      toast.success(ti("revoked"));
      setRevoking(null);
      qc.invalidateQueries({ queryKey: ["demo-invites"] });
    },
  });

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const invites = data?.results ?? [];
  const reset = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {ti("filters.status")}
            <Select className="w-auto" value={status} onChange={(e) => reset(() => setStatus(e.target.value as DemoInviteStatus | ""))}>
              <option value="">{t("all")}</option>
              {STATUSES.map((key) => (
                <option key={key} value={key}>
                  {ti(`status.${key}`)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {ti("filters.plan")}
            <Select className="w-auto" value={plan} onChange={(e) => reset(() => setPlan(e.target.value as DemoPlan | ""))}>
              <option value="">{t("all")}</option>
              {DEMO_PLANS.map((key) => (
                <option key={key} value={key}>
                  {tp(key)}
                </option>
              ))}
            </Select>
          </label>
          <Input
            aria-label={ti("filters.search")}
            placeholder={ti("filters.search")}
            value={search}
            onChange={(e) => reset(() => setSearch(e.target.value))}
            className="h-8 w-56"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label={t("refresh")}>
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button className="gap-2" onClick={() => setCreating(true)}>
            <Plus size={15} aria-hidden /> {ti("new")}
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : isLoading ? (
        <Skeleton className="h-48 w-full rounded-etiqueta" />
      ) : invites.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="font-medium">{ti("empty")}</p>
          <p className="text-sm text-muted-foreground">{ti("emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-etiqueta border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ti("columns.label")}</TableHead>
                <TableHead>{ti("columns.plan")}</TableHead>
                <TableHead>{ti("columns.scenario")}</TableHead>
                <TableHead>{ti("columns.status")}</TableHead>
                <TableHead className="text-right">{ti("columns.opens")}</TableHead>
                <TableHead>{ti("columns.lastOpened")}</TableHead>
                <TableHead>{ti("columns.expires")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.label}</TableCell>
                  <TableCell>{tp(invite.plan)}</TableCell>
                  <TableCell>{ts(invite.scenario)}</TableCell>
                  <TableCell>
                    <Badge variant={TONE[invite.status]}>{ti(`status.${invite.status}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{invite.opens_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {invite.last_opened_at ? date.format(new Date(invite.last_opened_at)) : ti("neverOpened")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{date.format(new Date(invite.expires_at))}</TableCell>
                  <TableCell className="text-right">
                    {invite.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setRevoking(invite)}>
                        {ti("revoke")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.info && data.info.total > 0 && <Pagination info={data.info} onPageChange={setPage} />}

      <InviteDialog open={creating} onOpenChange={setCreating} />

      <Dialog open={!!revoking} onOpenChange={(open) => !open && setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ti("revokeTitle")}</DialogTitle>
            <DialogDescription>{ti("revokeBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevoking(null)}>
              {ti("revokeCancel")}
            </Button>
            <Button variant="destructive" disabled={revoke.isPending} onClick={() => revoking && revoke.mutate(revoking)}>
              {ti("revokeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
