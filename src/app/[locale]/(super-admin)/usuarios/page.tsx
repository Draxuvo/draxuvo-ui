// src/app/[locale]/(super-admin)/usuarios/page.tsx
"use client";
import { useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { UserForm } from "@/components/admin-users/user-form";
import { UserDeleteDialog } from "@/components/admin-users/user-delete-dialog";
import { getAdminUserColumns } from "@/components/admin-users/columns";
import { adminUsersService } from "@/services/admin-users";
import { usePagination } from "@/hooks/use-pagination";
import type { AdminUser } from "@/types";

const PAGE_SIZE = 10;

export default function UsuariosPage() {
  const t = useTranslations("adminUsers");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { page, goTo, reset } = usePagination();

  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const toggleActiveMutation = useMutation({
    mutationFn: (id: number) => adminUsersService.toggleActive(id),
    onSuccess: (updated) => {
      toast.success(updated.active ? t("activateSuccess") : t("deactivateSuccess"));
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error(t("toggleError")),
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-users", page, PAGE_SIZE, debouncedSearch],
    queryFn: () => adminUsersService.list(page, debouncedSearch, PAGE_SIZE),
  });

  const users: AdminUser[] = data?.results ?? [];

  function handleSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      reset();
    }, 400);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      getAdminUserColumns(t, tc, {
        onEdit: (user) => {
          setEditing(user);
          setFormOpen(true);
        },
        onDelete: (user) => setDeleting(user),
        onToggleActive: (user) => toggleActiveMutation.mutate(user.id),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle", { count: data?.info?.total ?? 0 })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={tc("refresh")} onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus size={15} />
            {t("new")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="pl-8"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={users}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        loadingMessage={tc("loading")}
        emptyMessage={t("empty")}
      />

      {/* Pagination */}
      {data?.info && data.info.total > 0 && (
        <Pagination info={data.info} onPageChange={goTo} />
      )}

      {/* Form Sheet */}
      <UserForm open={formOpen} onOpenChange={setFormOpen} user={editing} />

      {/* Delete Dialog */}
      <UserDeleteDialog
        user={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  );
}
