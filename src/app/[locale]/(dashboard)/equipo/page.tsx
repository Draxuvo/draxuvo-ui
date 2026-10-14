// src/app/[locale]/(dashboard)/equipo/page.tsx
// Equipo de la empresa activa (US6, FR-026): owner y admin ven a las personas, invitan, cambian
// el rol y quitan. Nadie ofrece un rol mayor al suyo; los códigos de error de la API se muestran
// como mensajes propios (role_not_allowed, already_member, last_owner).
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { AlertTriangle, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { useAppRouter } from "@/hooks/use-router";
import { companyMembersService } from "@/services/company-members";
import { cn } from "@/lib/utils";
import type { CompanyMember, CompanyRole } from "@/types";

const PAGE_SIZE = 20;
const ROLES: CompanyRole[] = ["staff", "manager", "admin", "owner"];
const RANK: Record<CompanyRole, number> = { staff: 0, manager: 1, admin: 2, owner: 3 };
const TEAM_ROLES = new Set(["owner", "admin"]);
const ERROR_CODES = ["role_not_allowed", "already_member", "last_owner"] as const;
type ErrorCode = (typeof ERROR_CODES)[number] | "generic";

const FOCUS_RING =
  "foco-etiqueta";
const SELECT = cn(
  "h-11 rounded-etiqueta border border-border bg-card px-3 text-sm text-foreground transition-colors duration-[120ms] hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-60",
  FOCUS_RING,
);

/** `error.details.code` de la API, si es uno que la pantalla sabe explicar. */
function errorCode(error: unknown): ErrorCode {
  if (!isAxiosError(error)) return "generic";
  const code = error.response?.data?.error?.details?.code;
  return (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : "generic";
}

export default function EquipoPage() {
  const t = useTranslations("team");
  const tRoles = useTranslations("adminUsers.roles");
  const tc = useTranslations("common");
  const router = useAppRouter();
  const qc = useQueryClient();
  const { user, role, selectedCompanyId } = useAuthStore();

  const canManage = !!role && TEAM_ROLES.has(role);
  const myRank = role && role !== "super_admin" ? RANK[role] : -1;
  const assignable = ROLES.filter((r) => RANK[r] <= myRank);
  const companyName =
    user?.companies?.find((c) => c.id === selectedCompanyId)?.name ?? "";

  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<CompanyMember | null>(null);

  // Manager y staff no administran el equipo (staff ya lo bloquea proxy.ts).
  useEffect(() => {
    if (role && !canManage) router.replace(role === "staff" ? "/mis-ordenes" : "/inicio");
  }, [role, canManage, router]);

  const queryKey = ["company-members", selectedCompanyId, page];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => companyMembersService.list(page, PAGE_SIZE),
    enabled: canManage && !!selectedCompanyId,
  });
  const members = data?.results ?? [];

  const changeRole = useMutation({
    mutationFn: ({ member, next }: { member: CompanyMember; next: CompanyRole }) =>
      companyMembersService.updateRole(member.id, next),
    onSuccess: (updated, { member }) => {
      toast.success(
        t("roleUpdated", {
          name: `${member.first_name} ${member.last_name}`.trim(),
          role: tRoles(updated.role),
        }),
      );
      qc.invalidateQueries({ queryKey: ["company-members"] });
    },
    onError: (error) => {
      toast.error(t(`errors.${errorCode(error)}`));
      qc.invalidateQueries({ queryKey: ["company-members"] });
    },
  });

  if (!canManage) return null;

  const fullName = (m: CompanyMember) => `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email;
  // Nadie toca a alguien de rango mayor; la propia fila tampoco se edita aquí.
  const editable = (m: CompanyMember) => m.id !== user?.id && RANK[m.role] <= myRank;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle", { count: data?.info?.total ?? 0, company: companyName })}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="h-11 gap-2 rounded-etiqueta px-4 font-semibold">
          <UserPlus size={18} strokeWidth={1.75} aria-hidden />
          {t("invite")}
        </Button>
      </div>

      <section className="rounded-etiqueta border border-border bg-card shadow-etiqueta">
        {isLoading ? (
          <ul aria-busy className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 p-4">
                <div className="h-10 flex-1 rounded-etiqueta bg-muted motion-safe:animate-pulse" />
                <div className="h-11 w-36 rounded-etiqueta bg-muted motion-safe:animate-pulse" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <AlertTriangle size={18} strokeWidth={1.75} className="text-alerta" aria-hidden />
              {t("loadError")}
            </span>
            <Button variant="outline" onClick={() => refetch()} className="h-11 rounded-etiqueta">
              {tc("retry")}
            </Button>
          </div>
        ) : (
          <>
            <MemberList
              members={members}
              meId={user?.id}
              fullName={fullName}
              editable={editable}
              assignable={assignable}
              pending={changeRole.isPending ? changeRole.variables?.member.id : undefined}
              onRoleChange={(member, next) => changeRole.mutate({ member, next })}
              onRemove={setRemoving}
            />
            {members.every((m) => m.id === user?.id) && (
              <p className="border-t border-border p-4 text-sm text-muted-foreground">{t("empty")}</p>
            )}
          </>
        )}
      </section>

      {data?.info && data.info.pages_total > 1 && (
        <Pagination info={data.info} onPageChange={setPage} />
      )}

      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        assignable={assignable}
      />

      <RemoveDialog
        member={removing}
        companyName={companyName}
        fullName={fullName}
        onOpenChange={(open) => !open && setRemoving(null)}
      />
    </div>
  );
}

function MemberList({
  members,
  meId,
  fullName,
  editable,
  assignable,
  pending,
  onRoleChange,
  onRemove,
}: {
  members: CompanyMember[];
  meId?: number;
  fullName: (m: CompanyMember) => string;
  editable: (m: CompanyMember) => boolean;
  assignable: CompanyRole[];
  pending?: number;
  onRoleChange: (member: CompanyMember, next: CompanyRole) => void;
  onRemove: (member: CompanyMember) => void;
}) {
  const t = useTranslations("team");
  const tRoles = useTranslations("adminUsers.roles");

  return (
    <ul className="divide-y divide-border">
      {members.map((m) => {
        const canEdit = editable(m);
        // Si su rol actual queda fuera de lo asignable, igual se muestra como opción actual.
        const options = assignable.includes(m.role) ? assignable : [m.role, ...assignable];
        return (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
            <div className="min-w-0 flex-1 basis-56">
              <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                <span className="truncate">{fullName(m)}</span>
                {m.id === meId && (
                  <span className="shrink-0 rounded-full bg-ceja px-2 py-0.5 text-xs font-semibold text-foreground">
                    {t("you")}
                  </span>
                )}
                {!m.active && (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {t("inactive")}
                  </span>
                )}
              </p>
              <p className="truncate text-sm text-muted-foreground">{m.email}</p>
            </div>

            <div className="flex items-center gap-2">
              {canEdit ? (
                <select
                  aria-label={t("roleOf", { name: fullName(m) })}
                  value={m.role}
                  disabled={pending === m.id}
                  onChange={(e) => onRoleChange(m, e.target.value as CompanyRole)}
                  className={cn(SELECT, "w-40")}
                >
                  {options.map((r) => (
                    <option key={r} value={r}>
                      {tRoles(r)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-flex h-11 w-40 items-center px-3 text-sm font-medium text-foreground">
                  {tRoles(m.role)}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                disabled={!canEdit}
                onClick={() => onRemove(m)}
                aria-label={t("removeLabel", { name: fullName(m) })}
                title={canEdit ? t("remove") : undefined}
                className={cn(
                  "size-11 rounded-etiqueta text-muted-foreground hover:bg-alerta/10 hover:text-alerta",
                  !canEdit && "invisible",
                )}
              >
                <Trash2 size={18} strokeWidth={1.75} aria-hidden />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function InviteSheet({
  open,
  onOpenChange,
  assignable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignable: CompanyRole[];
}) {
  const t = useTranslations("team");
  const tRoles = useTranslations("adminUsers.roles");
  const qc = useQueryClient();
  const [apiError, setApiError] = useState<ErrorCode | null>(null);

  const schema = z.object({
    email: z.string().trim().email(t("emailInvalid")),
    first_name: z.string().trim().optional(),
    last_name: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    role: z.enum(["staff", "manager", "admin", "owner"]),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", first_name: "", last_name: "", phone: "", role: "staff" },
  });

  const invite = useMutation({
    mutationFn: (values: Values) =>
      companyMembersService.invite({
        ...values,
        first_name: values.first_name || undefined,
        last_name: values.last_name || undefined,
        phone: values.phone || undefined,
      }),
    onSuccess: (_, values) => {
      toast.success(t("invited", { email: values.email }));
      qc.invalidateQueries({ queryKey: ["company-members"] });
      handleOpenChange(false);
    },
    onError: (error) => setApiError(errorCode(error)),
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
      setApiError(null);
      invite.reset();
    }
    onOpenChange(next);
  }

  const field = "space-y-1.5";
  const label = "text-sm font-medium text-foreground";
  const hint = "font-normal text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="font-display text-2xl font-semibold">{t("inviteTitle")}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {t("inviteSubtitle")}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => {
            setApiError(null);
            invite.mutate(v);
          })}
          className="flex flex-1 flex-col"
          noValidate
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className={field}>
              <Label htmlFor="invite-email" className={label}>{t("email")}</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder={t("emailPlaceholder")}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "invite-email-error" : undefined}
                className="h-11"
                {...register("email")}
              />
              {errors.email && (
                <p id="invite-email-error" className="text-sm text-alerta">{errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={field}>
                <Label htmlFor="invite-first" className={label}>
                  {t("firstName")} <span className={hint}>({t("optional")})</span>
                </Label>
                <Input id="invite-first" className="h-11" {...register("first_name")} />
              </div>
              <div className={field}>
                <Label htmlFor="invite-last" className={label}>
                  {t("lastName")} <span className={hint}>({t("optional")})</span>
                </Label>
                <Input id="invite-last" className="h-11" {...register("last_name")} />
              </div>
            </div>

            <div className={field}>
              <Label htmlFor="invite-phone" className={label}>
                {t("phone")} <span className={hint}>({t("optional")})</span>
              </Label>
              <Input id="invite-phone" type="tel" className="h-11" {...register("phone")} />
            </div>

            <div className={field}>
              <Label htmlFor="invite-role" className={label}>{t("role")}</Label>
              <select
                id="invite-role"
                aria-describedby="invite-role-hint"
                className={cn(SELECT, "w-full")}
                {...register("role")}
              >
                {assignable.map((r) => (
                  <option key={r} value={r}>
                    {tRoles(r)}
                  </option>
                ))}
              </select>
              <p id="invite-role-hint" className="text-sm text-muted-foreground">{t("roleHint")}</p>
            </div>

            {apiError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-etiqueta border border-alerta/30 bg-alerta/[0.06] p-4 text-sm text-foreground"
              >
                <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-alerta" aria-hidden />
                {t(`errors.${apiError}`)}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" className="h-11 rounded-etiqueta" onClick={() => handleOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={invite.isPending} className="h-11 rounded-etiqueta px-5 font-semibold">
              {invite.isPending ? t("sending") : t("send")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function RemoveDialog({
  member,
  companyName,
  fullName,
  onOpenChange,
}: {
  member: CompanyMember | null;
  companyName: string;
  fullName: (m: CompanyMember) => string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("team");
  const qc = useQueryClient();
  const [apiError, setApiError] = useState<ErrorCode | null>(null);

  const remove = useMutation({
    mutationFn: (m: CompanyMember) => companyMembersService.remove(m.id),
    onSuccess: (_, m) => {
      toast.success(t("removed", { name: fullName(m) }));
      qc.invalidateQueries({ queryKey: ["company-members"] });
      close();
    },
    onError: (error) => setApiError(errorCode(error)),
  });

  function close() {
    setApiError(null);
    remove.reset();
    onOpenChange(false);
  }

  const name = member ? fullName(member) : "";

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("removeTitle")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("removeConfirm", { name, company: companyName })}
          </DialogDescription>
        </DialogHeader>
        {apiError && (
          <p role="alert" className="flex items-start gap-2 text-sm text-foreground">
            <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-alerta" aria-hidden />
            {t(`errors.${apiError}`)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" className="h-11 rounded-etiqueta" onClick={close}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            className="h-11 rounded-etiqueta"
            disabled={remove.isPending || !member}
            onClick={() => member && remove.mutate(member)}
          >
            {remove.isPending ? t("removing") : t("remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
